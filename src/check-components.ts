import type { Node } from "unist";
import { safeParse, looseObject, optional, string } from "valibot";
import type { GenericSchema } from "valibot";

import { diagnosticAt } from "./check-diagnostics.js";
import type { DocumentDiagnostic } from "./check-diagnostics.js";
import type { ComponentMap } from "./define.js";
import { suggestName } from "./format-error.js";
import { isRecord, own } from "./guards.js";
import type { MdxTarget } from "./remark/ast.js";

const CODE_FILE_SCHEMA = looseObject({
  lang: optional(string()),
  lines: optional(string()),
  path: string(),
});
const GLOBAL_PROPS = new Set(["children", "className", "id", "key", "ref"]);

interface LiteralAttribute {
  type: "mdxJsxAttribute";
  name: string;
  value: string | null;
}

const isLiteralAttribute = (value: unknown): value is LiteralAttribute =>
  isRecord(value) &&
  value.type === "mdxJsxAttribute" &&
  typeof value.name === "string" &&
  (value.value === null || typeof value.value === "string");

const attributeNode = (node: MdxTarget, name: string): Node => {
  if (Array.isArray(node.attributes)) {
    for (const attribute of node.attributes) {
      if (
        isRecord(attribute) &&
        attribute.name === name &&
        isRecord(attribute.position) &&
        isRecord(attribute.position.start) &&
        typeof attribute.position.start.line === "number" &&
        typeof attribute.position.start.column === "number"
      ) {
        const start = {
          column: attribute.position.start.column,
          line: attribute.position.start.line,
        };
        return {
          data: node.data,
          position: { end: start, start },
          type: "attribute",
        };
      }
    }
  }
  return node;
};

const componentAttributes = (
  node: MdxTarget,
  file: string,
  keys: string[]
): { props: Record<string, unknown>; diagnostics: DocumentDiagnostic[] } => {
  const props: Record<string, unknown> = {};
  const diagnostics: DocumentDiagnostic[] = [];
  const attributes = Array.isArray(node.attributes) ? node.attributes : [];
  for (const attribute of attributes.filter(isLiteralAttribute)) {
    const attributeName = attribute.name;
    if (Object.hasOwn(props, attributeName)) {
      diagnostics.push(
        diagnosticAt(
          file,
          attributeNode(node, attributeName),
          "mdxr:duplicate-attribute",
          `Duplicate attribute "${attributeName}" on <${node.name}>.`
        )
      );
      continue;
    }
    Object.defineProperty(props, attributeName, {
      enumerable: true,
      value: attribute.value ?? true,
    });
    // Empty schemas describe components with open-ended passthrough props.
    if (
      keys.length > 0 &&
      !keys.includes(attributeName) &&
      !GLOBAL_PROPS.has(attributeName) &&
      !/^(?:aria|data)-/u.test(attributeName)
    ) {
      diagnostics.push(
        diagnosticAt(
          file,
          attributeNode(node, attributeName),
          "mdxr:unknown-attribute",
          `Unknown attribute "${attributeName}" on <${node.name}>.`,
          "warning",
          suggestName(attributeName, keys)
        )
      );
    }
  }
  return { diagnostics, props };
};

const validateProps = (
  schema: GenericSchema,
  props: Record<string, unknown>,
  node: MdxTarget,
  file: string
): DocumentDiagnostic[] => {
  const diagnostics: DocumentDiagnostic[] = [];
  const result = safeParse(schema, props);
  if (!result.success) {
    for (const issue of result.issues) {
      const key = issue.path?.[0]?.key;
      const attribute = typeof key === "string" ? key : undefined;
      diagnostics.push(
        diagnosticAt(
          file,
          attribute === undefined ? node : attributeNode(node, attribute),
          "mdxr:invalid-props",
          `<${node.name}>${attribute === undefined ? "" : ` ${attribute}`}: ${issue.message}`
        )
      );
    }
  }
  return diagnostics;
};

/** Validate literal attributes with the renderer's schemas, without rendering. */
export const checkComponent = (
  node: MdxTarget,
  file: string,
  components: ComponentMap
): DocumentDiagnostic[] => {
  const name = node.name ?? "";
  if (name === "" || /^[a-z]/u.test(name)) {
    return [];
  }
  const component = own(components, name);
  if (component === undefined && name !== "CodeFile") {
    return [
      diagnosticAt(
        file,
        node,
        "mdxr:unknown-component",
        `Unknown component <${name}>. Use --render to load project components.`,
        "error",
        suggestName(name, Object.keys(components))
      ),
    ];
  }
  const schema =
    name === "CodeFile" ? CODE_FILE_SCHEMA : component?.__mdxr?.schema;
  const keys =
    component?.__mdxr?.allowUnknownAttributes !== true &&
    isRecord(schema) &&
    isRecord(schema.entries)
      ? Object.keys(schema.entries)
      : [];
  const { diagnostics, props } = componentAttributes(node, file, keys);
  return schema === undefined
    ? diagnostics
    : [...diagnostics, ...validateProps(schema, props, node, file)];
};

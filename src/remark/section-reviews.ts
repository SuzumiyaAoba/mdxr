import { createHash } from "node:crypto";

import type { Node, Parent } from "unist";
import { visit } from "unist-util-visit";

import { isRecord } from "../guards.js";
import { isFlowElement, jsxAttr, jsxAttrs } from "./ast.js";

const referenceDefinitions = (tree: Node): Map<string, Node> => {
  const definitions = new Map<string, Node>();
  visit(tree, ["definition", "footnoteDefinition"], (node) => {
    if ("identifier" in node && typeof node.identifier === "string") {
      const key = `${node.type}:${node.identifier}`;
      if (!definitions.has(key)) {
        definitions.set(key, node);
      }
    }
  });
  return definitions;
};

/** Links and footnotes may resolve to definitions outside their section. */
const referencedContent = (
  section: Node,
  definitions: Map<string, Node>
): Node[] => {
  const found = new Set<Node>();
  const collect = (tree: Node): void => {
    visit(
      tree,
      ["linkReference", "imageReference", "footnoteReference"],
      (node) => {
        if (!("identifier" in node) || typeof node.identifier !== "string") {
          return;
        }
        const kind =
          node.type === "footnoteReference"
            ? "footnoteDefinition"
            : "definition";
        const definition = definitions.get(`${kind}:${node.identifier}`);
        if (definition !== undefined && !found.has(definition)) {
          found.add(definition);
          collect(definition);
        }
      }
    );
  };
  collect(section);
  return [...found];
};

/** Ignore source offsets so edits to another section do not reset a review. */
const sectionRevision = (
  children: Node[],
  definitions: Map<string, Node>
): string => {
  const section: Parent = { children, type: "root" };
  return createHash("sha256")
    .update(
      JSON.stringify(
        [children, referencedContent(section, definitions)],
        (key, value: unknown) =>
          key === "position" || key === "data" ? undefined : value
      )
    )
    .digest("hex");
};

/** Runs after page splitting; only document-level h2 sections are reviewable. */
export const remarkSectionReviews = () => (tree: Node) => {
  const definitions = referenceDefinitions(tree);
  visit(tree, "mdxJsxFlowElement", (node: Node) => {
    if (!isFlowElement(node) || jsxAttr(node, "data-mdxr-page") === undefined) {
      return;
    }
    const [heading] = node.children ?? [];
    const data = heading?.data;
    const properties = isRecord(data) ? data.hProperties : undefined;
    if (
      heading?.type !== "heading" ||
      !("depth" in heading) ||
      heading.depth !== 2 ||
      !isRecord(properties) ||
      typeof properties.id !== "string" ||
      node.children === undefined
    ) {
      return;
    }
    const control = {
      attributes: jsxAttrs({
        "data-section-id": properties.id,
        "data-section-revision": sectionRevision(node.children, definitions),
        "data-section-title": jsxAttr(node, "data-mdxr-page-title"),
      }),
      children: [],
      name: "mdxr-section-review",
      type: "mdxJsxFlowElement",
    };
    // The empty host belongs to React; the browser owns its shadow tree.
    // This also works for plain Markdown and --no-hydrate output.
    const headingRow = {
      attributes: jsxAttrs({ className: "mdxr-section-heading" }),
      children: [heading, control],
      name: "div",
      type: "mdxJsxFlowElement",
    };
    node.children.splice(0, 1, headingRow);
  });
};

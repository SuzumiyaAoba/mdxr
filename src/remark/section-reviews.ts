import { createHash } from "node:crypto";

import type { Node, Parent } from "unist";
import { visit } from "unist-util-visit";

import { isRecord } from "../guards.js";
import { isFlowElement, jsxAttr, jsxAttrs } from "./ast.js";
import {
  referenceDefinitions,
  referencedContent,
} from "./reference-definitions.js";

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
    if (!isFlowElement(node) || jsxAttr(node, "data-doc-page") === undefined) {
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
        "data-section-title": jsxAttr(node, "data-doc-page-title"),
      }),
      children: [],
      name: "doc-section-review",
      type: "mdxJsxFlowElement",
    };
    // The empty host belongs to React; the browser owns its shadow tree.
    // This also works for plain Markdown and --no-hydrate output.
    const headingRow = {
      attributes: jsxAttrs({ className: "doc-section-heading" }),
      children: [heading, control],
      name: "div",
      type: "mdxJsxFlowElement",
    };
    node.children.splice(0, 1, headingRow);
  });
};

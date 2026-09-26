import type { Node, Parent } from "unist";

import { isFlowElement, isParent, jsxAttrs, textContent } from "./ast.js";
import type { MdxTarget } from "./ast.js";

const isPageHeading = (node: Node): boolean =>
  node.type === "heading" && "depth" in node && node.depth === 2;

const isMetadata = (node: Node): boolean =>
  ["yaml", "definition", "mdxFlowExpression"].includes(node.type);

/** A document may put its entire body inside the catalog's <Plan> root. */
const documentBody = (root: Parent): Parent => {
  const content = root.children.filter((node) => !isMetadata(node));
  const [child] = content;
  return content.length === 1 &&
    child !== undefined &&
    isFlowElement(child) &&
    child.name === "Plan" &&
    isParent(child)
    ? child
    : root;
};

/**
 * Compile page boundaries into both SSR and hydration. The browser only
 * changes CSS outside the React root, so switching pages never moves or
 * remounts interactive components. Nested component headings stay intact.
 */
export const remarkDocumentPages =
  () =>
  (tree: Node): void => {
    if (!isParent(tree)) {
      return;
    }
    const parent = documentBody(tree);
    if (!parent.children.some(isPageHeading)) {
      return;
    }
    const children: Node[] = [];
    let page: MdxTarget | undefined;
    let index = 0;
    for (const node of parent.children) {
      if (isMetadata(node)) {
        children.push(node);
        continue;
      }
      if (page === undefined || isPageHeading(node)) {
        const title = isPageHeading(node)
          ? textContent(node).trim() || `Section ${index + 1}`
          : "Overview";
        page = {
          attributes: jsxAttrs({
            "data-mdxr-page": String(index),
            "data-mdxr-page-title": title,
            id: `mdxr-page:${index}`,
          }),
          children: [],
          name: "div",
          type: "mdxJsxFlowElement",
        };
        children.push(page);
        index += 1;
      }
      page.children?.push(node);
    }
    parent.children = children;
  };

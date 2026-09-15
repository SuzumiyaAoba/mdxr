import type { Node } from "unist";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

/**
 * rv documents are data, not code: reject ESM imports/exports and JS
 * expressions (`{...}`). Extensibility happens through rv.config.ts, not
 * through executable markup inside the document.
 */
export const remarkNoJs = () => (tree: Node, file: VFile) => {
  visit(tree, (node: Node) => {
    if (
      node.type === "mdxjsEsm" ||
      node.type === "mdxFlowExpression" ||
      node.type === "mdxTextExpression"
    ) {
      file.fail(
        "JavaScript expressions and import/export statements are not allowed in rv documents. Add a component via rv.config.ts instead.",
        node,
        "rv:no-js"
      );
    }
  });
};

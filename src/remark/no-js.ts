import type { Node } from "unist";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

const JS_NODES = ["mdxjsEsm", "mdxFlowExpression", "mdxTextExpression"];

/**
 * mdxr documents are data, not code: reject ESM imports/exports and JS
 * expressions (`{...}`). Extensibility happens through mdxr.config.ts, not
 * through executable markup inside the document.
 */
export const remarkNoJs = () => (tree: Node, file: VFile) => {
  visit(tree, JS_NODES, (node: Node) => {
    file.fail(
      "JavaScript expressions and import/export statements are not allowed in mdxr documents. Add a component via mdxr.config.ts instead.",
      node,
      "mdxr:no-js"
    );
  });
};

import type { Node } from "unist";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

import { isRecord } from "../guards.js";

const JS_NODES = ["mdxjsEsm", "mdxFlowExpression", "mdxTextExpression"];
const JSX_ELEMENTS = ["mdxJsxFlowElement", "mdxJsxTextElement"];

const MESSAGE =
  "JavaScript expressions and import/export statements are not allowed in mdxr documents. Add a component via mdxr.config.ts instead.";

/**
 * mdxr documents are data, not code: reject ESM imports/exports and JS
 * expressions (`{...}`) — including inside JSX attributes (`prop={x}`,
 * `{...spread}`), which `visit` never reaches because attributes are not
 * children. Extensibility happens through mdxr.config.ts, not through
 * executable markup inside the document.
 */
export const remarkNoJs = () => (tree: Node, file: VFile) => {
  visit(tree, JS_NODES, (node: Node) => {
    file.fail(MESSAGE, node, "mdxr:no-js");
  });
  visit(tree, JSX_ELEMENTS, (node: Node) => {
    if (!("attributes" in node) || !Array.isArray(node.attributes)) {
      return;
    }
    for (const attr of node.attributes) {
      // String-valued attributes are data; `{expr}` values and `{...x}`
      // spreads are live JavaScript evaluated at render time.
      if (
        isRecord(attr) &&
        (attr.type !== "mdxJsxAttribute" ||
          (attr.value !== null && typeof attr.value !== "string"))
      ) {
        file.fail(MESSAGE, node, "mdxr:no-js");
      }
    }
  });
};

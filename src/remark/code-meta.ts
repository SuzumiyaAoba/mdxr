import type { Node } from "unist";
import { visit } from "unist-util-visit";

import { setHProperty } from "./ast.js";

/**
 * The mdast→hast conversion drops the code fence info string (`meta`).
 * Copy it to `hProperties.meta` so it reaches the `pre` element's props.
 */
export const remarkCodeMeta = () => (tree: Node) => {
  visit(tree, "code", (node: Node) => {
    if (
      !("meta" in node) ||
      typeof node.meta !== "string" ||
      node.meta === ""
    ) {
      return;
    }
    setHProperty(node, "meta", node.meta);
  });
};

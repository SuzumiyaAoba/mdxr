import type { Node } from "unist";
import { visit } from "unist-util-visit";

import { isRecord } from "../guards.js";

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
    const data: Record<string, unknown> = isRecord(node.data) ? node.data : {};
    node.data = data;
    data.hProperties = {
      ...(isRecord(data.hProperties) ? data.hProperties : {}),
      meta: node.meta,
    };
  });
};

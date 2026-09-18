import type { Node } from "unist";
import { visit } from "unist-util-visit";

import type { MdxTarget } from "./ast.js";
import { isParent, toMdxElement } from "./ast.js";
import { ALERT_RE, normalizeCalloutKind } from "./callouts.js";

/** A text node with a mutable string `value` — callers edit it in place. */
const isTextValue = (n: Node | undefined): n is MdxTarget & { value: string } =>
  n !== undefined &&
  n.type === "text" &&
  "value" in n &&
  typeof n.value === "string";

/**
 * GitHub-style alerts become Callout components:
 *   > [!WARNING]
 *   > Be careful.
 * renders identically to <Callout kind="warning">.
 */
export const remarkMdxrAlerts = () => (tree: Node) => {
  visit(tree, "blockquote", (node: Node) => {
    if (!isParent(node)) {
      return;
    }
    const [first] = node.children;
    if (first === undefined || first.type !== "paragraph" || !isParent(first)) {
      return;
    }
    const [text] = first.children;
    if (!isTextValue(text)) {
      return;
    }

    const m = ALERT_RE.exec(text.value);
    if (m === null || m.groups === undefined) {
      return;
    }

    const rest = text.value.slice(m[0].length);
    text.value = rest;
    if (rest === "") {
      first.children.shift();
    }
    if (first.children.length === 0) {
      node.children.shift();
    }

    toMdxElement(node, "mdxJsxFlowElement", "Callout", {
      kind: normalizeCalloutKind(m.groups.kind),
    });
  });
};

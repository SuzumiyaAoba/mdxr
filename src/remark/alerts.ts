import type { Node, Parent } from "unist";
import { visit } from "unist-util-visit";

const ALERT_RE =
  /^\[!(?<kind>note|tip|important|warning|caution|danger|decision|goal|non-?goal|question|answer)\]\s*/iu;

const isParent = (n: Node): n is Parent =>
  "children" in n && Array.isArray(n.children);

const textValue = (n: Node | undefined): { value: string } | undefined =>
  n !== undefined &&
  n.type === "text" &&
  "value" in n &&
  typeof n.value === "string"
    ? { value: n.value }
    : undefined;

/** A node we mutate into an `mdxJsxFlowElement`. Optional fields accept any Node. */
type MdxTarget = Node & { name?: string; attributes?: unknown };

/**
 * GitHub-style alerts become Callout components:
 *   > [!WARNING]
 *   > Be careful.
 * renders identically to <Callout kind="warning">.
 */
export const remarkRvAlerts = () => (tree: Node) => {
  visit(tree, "blockquote", (node: Node) => {
    if (!isParent(node)) {
      return;
    }
    const [first] = node.children;
    if (first === undefined || first.type !== "paragraph" || !isParent(first)) {
      return;
    }
    const text = textValue(first.children[0]);
    if (text === undefined) {
      return;
    }

    const m = ALERT_RE.exec(text.value);
    if (m === null) {
      return;
    }

    const rest = text.value.slice(m[0].length);
    const [textNode] = first.children;
    if (textNode !== undefined && "value" in textNode) {
      textNode.value = rest;
    }
    if (rest === "") {
      first.children.shift();
    }
    if (first.children.length === 0) {
      node.children.shift();
    }

    const kind = (m.groups?.kind.toLowerCase() ?? "note").replace(
      /^non-goal$/u,
      "nongoal"
    );

    const target: MdxTarget = node;
    target.type = "mdxJsxFlowElement";
    target.name = "Callout";
    target.attributes = [
      {
        name: "kind",
        type: "mdxJsxAttribute",
        value: kind,
      },
    ];
  });
};

import type { Node, Parent } from "unist";
import { visit } from "unist-util-visit";

import { isRecord } from "../guards.js";

const CALLOUT_KINDS = new Set([
  "note",
  "tip",
  "important",
  "warning",
  "caution",
  "danger",
  "decision",
  "goal",
  "nongoal",
  "question",
]);

const CONTAINER_COMPONENTS: Record<string, string> = {
  phase: "Phase",
  plan: "Plan",
  steps: "Steps",
  summary: "Summary",
  timeline: "Timeline",
  toc: "Toc",
};

interface DirectiveNode extends Parent {
  name: string;
  attributes: Record<string, unknown>;
}

const isDirective = (n: Node): n is DirectiveNode =>
  "name" in n &&
  typeof n.name === "string" &&
  "attributes" in n &&
  isRecord(n.attributes);

/** A node we mutate into an `mdxJsxFlowElement`. Optional fields accept any Parent. */
type MdxTarget = Parent & { name?: string; attributes?: unknown };

const textContent = (node: Node): string => {
  let out = "";
  visit(node, "text", (n: Node) => {
    if ("value" in n && typeof n.value === "string") {
      out += n.value;
    }
  });
  return out;
};

const toMdxComponent = (
  node: MdxTarget,
  name: string,
  attrs: Record<string, unknown>
) => {
  node.type = "mdxJsxFlowElement";
  node.name = name;
  node.attributes = Object.entries(attrs)
    .filter(([, val]) => val !== null && val !== undefined && val !== "")
    .map(([key, val]) => ({
      name: key,
      type: "mdxJsxAttribute",
      value: String(val),
    }));
};

/**
 * remark-directive containers become rv components:
 *   :::note[Optional label]        → <Callout kind="note" title="Optional label">
 *   :::phase{title="X" status="doing"} → <Phase title="X" status="doing">
 *   :::plan / :::steps / :::summary / :::timeline → Plan / Steps / Summary / Timeline
 * `non-goal` is accepted as an alias of the `nongoal` callout kind.
 */
export const remarkRvDirectives = () => (tree: Node) => {
  visit(tree, "containerDirective", (node: Node) => {
    if (!isDirective(node)) {
      return;
    }
    const directive = node;
    const name = directive.name === "non-goal" ? "nongoal" : directive.name;
    const attrs: Record<string, unknown> = { ...directive.attributes };

    const [first] = directive.children;
    const isLabel =
      first !== undefined &&
      isRecord(first.data) &&
      first.data.directiveLabel === true;
    if (isLabel) {
      attrs.title ??= textContent(first).trim();
      directive.children.shift();
    }

    if (CALLOUT_KINDS.has(name)) {
      toMdxComponent(directive, "Callout", { kind: name, ...attrs });
    } else if (CONTAINER_COMPONENTS[name] !== undefined) {
      toMdxComponent(directive, CONTAINER_COMPONENTS[name], attrs);
    }
  });
};

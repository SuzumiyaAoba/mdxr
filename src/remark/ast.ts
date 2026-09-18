/** AST helpers shared by the remark plugins (mdast/mdx node poking). */

import type { Node, Parent } from "unist";
import { visit } from "unist-util-visit";

import { isRecord } from "../guards.js";

/**
 * A node mutated into an `mdxJsx*Element` (or read as one): `type`, `name`,
 * `attributes`, and `children` are all assignable. The real
 * `MdxJsxFlowElement` type is intentionally not required — these helpers
 * accept any unist node mid-mutation.
 */
export interface MdxTarget extends Node {
  attributes?: unknown;
  children?: Node[];
  name?: string;
  value?: unknown;
}

export const isParent = (n: Node): n is Parent =>
  "children" in n && Array.isArray(n.children);

export const isFlowElement = (n: Node): n is MdxTarget =>
  n.type === "mdxJsxFlowElement";

/** All `text` node values under `node`, concatenated in tree order. */
export const textContent = (node: Node): string => {
  let out = "";
  visit(node, "text", (n: Node) => {
    if ("value" in n && typeof n.value === "string") {
      out += n.value;
    }
  });
  return out;
};

/** A JSX attribute's string value, or undefined when absent/empty/non-string. */
export const jsxAttr = (node: MdxTarget, name: string): string | undefined => {
  if (!Array.isArray(node.attributes)) {
    return undefined;
  }
  for (const a of node.attributes) {
    if (
      isRecord(a) &&
      a.name === name &&
      typeof a.value === "string" &&
      a.value !== ""
    ) {
      return a.value;
    }
  }
  return undefined;
};

/**
 * `Record` → `mdxJsxAttribute[]`. null/undefined/"" values are dropped —
 * MDX attributes arrive as strings, so everything is `String()`-coerced.
 */
export const jsxAttrs = (
  attrs: Record<string, unknown>
): { name: string; type: "mdxJsxAttribute"; value: string }[] =>
  Object.entries(attrs)
    .filter(([, val]) => val !== null && val !== undefined && val !== "")
    .map(([key, val]) => ({
      name: key,
      type: "mdxJsxAttribute",
      value: String(val),
    }));

/** Mutate `node` into an `mdxJsxFlowElement`/`mdxJsxTextElement` in place. */
export const toMdxElement = (
  node: MdxTarget,
  kind: "mdxJsxFlowElement" | "mdxJsxTextElement",
  name: string,
  attrs: Record<string, unknown>
): void => {
  node.type = kind;
  node.name = name;
  node.attributes = jsxAttrs(attrs);
};

/**
 * Merge `key: value` into `node.data.hProperties` (creating both levels).
 * The mdast→hast bridge turns hProperties into element props.
 */
export const setHProperty = (node: Node, key: string, value: unknown): void => {
  const data: Record<string, unknown> = isRecord(node.data) ? node.data : {};
  node.data = data;
  data.hProperties = {
    ...(isRecord(data.hProperties) ? data.hProperties : {}),
    [key]: value,
  };
};

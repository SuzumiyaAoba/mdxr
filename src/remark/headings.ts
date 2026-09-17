import type { Node, Parent } from "unist";
import { visit } from "unist-util-visit";

import { isRecord } from "../guards.js";

interface HeadingNode extends Parent {
  depth: number;
  type: "heading";
}

interface FlowElement extends Node {
  attributes?: unknown;
  children?: Node[];
  name?: string;
}

const isHeading = (n: Node): n is HeadingNode => n.type === "heading";

const isFlowElement = (n: Node): n is FlowElement =>
  n.type === "mdxJsxFlowElement";

const textContent = (node: Node): string => {
  let out = "";
  visit(node, "text", (n: Node) => {
    if ("value" in n && typeof n.value === "string") {
      out += n.value;
    }
  });
  return out;
};

/** GitHub-style slug: lowercase, punctuation stripped, spaces → `-`. */
const slugify = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replaceAll(/[^\p{L}\p{N}_\s-]/gu, "")
    .replaceAll(/\s+/gu, "-");

const attr = (node: FlowElement, name: string): string | undefined => {
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

interface TocItem {
  children: TocItem[];
  depth: number;
  slug: string;
  text: string;
}

/** Nest a flat heading list by depth (an h3 under the previous h2, …). */
const nest = (headings: TocItem[]): TocItem[] => {
  const roots: TocItem[] = [];
  const stack: TocItem[] = [];
  for (const h of headings) {
    while (stack.length > 0 && (stack.at(-1)?.depth ?? 0) >= h.depth) {
      stack.pop();
    }
    const parent = stack.at(-1);
    if (parent === undefined) {
      roots.push(h);
    } else {
      parent.children.push(h);
    }
    stack.push(h);
  }
  return roots;
};

interface ListNode extends Parent {
  ordered?: boolean;
  spread?: boolean;
}

const toList = (items: TocItem[]): ListNode => ({
  children: items.map((item) => ({
    children: [
      {
        children: [
          {
            children: [{ type: "text", value: item.text }],
            type: "link",
            url: `#${item.slug}`,
          },
        ],
        type: "paragraph",
      },
      ...(item.children.length > 0 ? [toList(item.children)] : []),
    ],
    spread: false,
    type: "listItem",
  })),
  ordered: false,
  spread: false,
  type: "list",
});

/**
 * Two jobs, one pass over the document:
 * 1. Every heading gets an `id` (GitHub-style slug, deduplicated), enabling
 *    deep links.
 * 2. `<Toc>` elements (`:::toc` included) get a nested link list injected as
 *    children — `depth`/`min` attributes bound the heading levels included
 *    (defaults: h2–h3, i.e. min=2 depth=3).
 */
export const remarkMdxrHeadings = () => (tree: Node) => {
  const seen = new Map<string, number>();
  const headings: TocItem[] = [];

  visit(tree, (node: Node) => {
    if (!isHeading(node)) {
      return;
    }
    const text = textContent(node).trim();
    const base = slugify(text) || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const slug = count === 0 ? base : `${base}-${count}`;

    const data: Record<string, unknown> = isRecord(node.data) ? node.data : {};
    node.data = data;
    data.hProperties = {
      ...(isRecord(data.hProperties) ? data.hProperties : {}),
      id: slug,
    };
    headings.push({ children: [], depth: node.depth, slug, text });
  });

  visit(tree, "mdxJsxFlowElement", (node: Node) => {
    if (!isFlowElement(node) || node.name !== "Toc") {
      return;
    }
    const minDepth = Number(attr(node, "min") ?? "2") || 2;
    const maxDepth = Number(attr(node, "depth") ?? "3") || 3;
    const items = headings.filter(
      (h) => h.depth >= minDepth && h.depth <= maxDepth && h.text !== ""
    );
    node.children = items.length === 0 ? [] : [toList(nest(items))];
  });
};

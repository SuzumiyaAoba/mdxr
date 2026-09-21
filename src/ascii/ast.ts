/** mdast plumbing for ASCII renderers: attribute readers, node builders,
 *  and the recursive mdxJsx → markdown transform. */

import type {
  Blockquote,
  Break,
  Code,
  Delete,
  Emphasis,
  Heading,
  Html,
  Image,
  InlineCode,
  Link,
  List,
  ListItem,
  Paragraph,
  PhrasingContent,
  RootContent,
  Strong,
  Table,
  TableCell,
  TableRow,
  Text,
  ThematicBreak,
} from "mdast";
import type { Node, Parent } from "unist";

import { isRecord, own } from "../guards.js";
import { isParent, jsxAttr, textContent } from "../remark/ast.js";
import type { MdxTarget } from "../remark/ast.js";
import { attrTrue, numOf } from "../ui/attrs.js";
import { textList } from "../ui/chart.js";

export type { MdxTarget } from "../remark/ast.js";

/** `name` attribute as a string (MDX attributes always are), else undefined. */
export const attr = (node: MdxTarget, name: string): string | undefined =>
  jsxAttr(node, name);

/**
 * Boolean-ish attribute: bare `open` arrives as value `null`, `open="false"`
 * as `"false"` — presence means on unless explicitly false. Mirrors the
 * `attrTrue` semantics the HTML components use.
 */
export const flag = (node: MdxTarget, name: string): boolean => {
  if (!Array.isArray(node.attributes)) {
    return false;
  }
  for (const a of node.attributes) {
    if (isRecord(a) && a.name === name) {
      return a.value === null || a.value === true || attrTrue(a.value);
    }
  }
  return false;
};

/** Attribute explicitly set to the string `"false"` (open="false" opt-outs). */
export const flagOff = (node: MdxTarget, name: string): boolean =>
  attr(node, name) === "false";

/** Numeric part of an attribute — `"120ms"` → 120. */
export const num = (node: MdxTarget, name: string): number | undefined =>
  numOf(attr(node, name));

/** Comma-separated attribute list (`labels="a,b"`). */
export const csv = (node: MdxTarget, name: string): string[] =>
  textList(attr(node, name));

const isMdxEl = (n: Node): n is MdxTarget =>
  n.type === "mdxJsxFlowElement" || n.type === "mdxJsxTextElement";

/** `n` is an mdx JSX element rendered by `name` (e.g. `named(c, "Stat")`). */
export const named = (n: Node, name: string): n is MdxTarget =>
  isMdxEl(n) && n.name === name;

/**
 * A paragraph holding nothing but JSX elements (and whitespace): MDX parses
 * `<Step>text</Step>` on its own line as a *text* element inside a paragraph,
 * so container renderers must look one level in to find their item children.
 */
const hoistable = (c: Node): c is Parent =>
  c.type === "paragraph" &&
  isParent(c) &&
  c.children.every(
    (cc) =>
      isMdxEl(cc) ||
      (cc.type === "text" &&
        "value" in cc &&
        typeof cc.value === "string" &&
        cc.value.trim() === "")
  );

/**
 * JSX-element children of `node`, optionally filtered by name — including
 * elements hoisted out of element-only paragraphs (see `hoistable`).
 */
export const els = (node: MdxTarget, name?: string): MdxTarget[] => {
  const out: MdxTarget[] = [];
  for (const c of node.children ?? []) {
    if (isMdxEl(c)) {
      if (name === undefined || c.name === name) {
        out.push(c);
      }
      continue;
    }
    if (hoistable(c)) {
      for (const cc of c.children) {
        if (isMdxEl(cc) && (name === undefined || cc.name === name)) {
          out.push(cc);
        }
      }
    }
  }
  return out;
};

/**
 * `node` minus the named JSX children — direct elements removed, matching
 * elements stripped out of paragraphs (now-empty paragraphs dropped).
 */
export const withoutEls = (node: MdxTarget, names: string[]): MdxTarget => ({
  ...node,
  children: (node.children ?? []).flatMap((c): Node[] => {
    if (isMdxEl(c)) {
      return names.includes(c.name ?? "") ? [] : [c];
    }
    if (c.type === "paragraph" && isParent(c)) {
      const kids = c.children.filter(
        (cc) => !(isMdxEl(cc) && names.includes(cc.name ?? ""))
      );
      const empty = kids.every(
        (cc) =>
          cc.type === "text" &&
          "value" in cc &&
          typeof cc.value === "string" &&
          cc.value.trim() === ""
      );
      return empty ? [] : [{ ...c, children: kids } as Node];
    }
    return [c];
  }),
});

/** All literal text under `node` (text + inlineCode values, tree order). */
export const textOf = (node: Node | Node[]): string =>
  Array.isArray(node) ? node.map(textContent).join("") : textContent(node);

/* ------------------------------------------------------------------ */
/* Node builders                                                       */
/* ------------------------------------------------------------------ */

export const txt = (value: string): Text => ({ type: "text", value });

export const icode = (value: string): InlineCode => ({
  type: "inlineCode",
  value,
});

export const strong = (children: PhrasingContent[]): Strong => ({
  children,
  type: "strong",
});

export const em = (children: PhrasingContent[]): Emphasis => ({
  children,
  type: "emphasis",
});

export const del = (children: PhrasingContent[]): Delete => ({
  children,
  type: "delete",
});

export const link = (url: string, children: PhrasingContent[]): Link => ({
  children,
  type: "link",
  url,
});

export const brk = (): Break => ({ type: "break" });

export const para = (children: PhrasingContent[]): Paragraph => ({
  children,
  type: "paragraph",
});

/** Verbatim fenced block — ASCII art, transcripts, JSON payloads. */
export const pre = (value: string, lang?: string): Code => ({
  type: "code",
  ...(lang === undefined ? {} : { lang }),
  value: value.replace(/\n+$/u, ""),
});

/** Raw HTML passthrough (`<details>` blocks render on GitHub too). */
export const html = (value: string): Html => ({ type: "html", value });

export const heading = (
  depth: 1 | 2 | 3 | 4 | 5 | 6,
  children: PhrasingContent[]
): Heading => ({ children, depth, type: "heading" });

export const thematic = (): ThematicBreak => ({ type: "thematicBreak" });

export const quote = (children: RootContent[]): Blockquote => ({
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- callers only ever pass block nodes
  children: children as Blockquote["children"],
  type: "blockquote",
});

export const item = (children: RootContent[], checked?: boolean): ListItem => ({
  ...(checked === undefined ? {} : { checked }),
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- callers only ever pass block nodes
  children: children as ListItem["children"],
  spread: false,
  type: "listItem",
});

export const list = (children: ListItem[], ordered = false): List => ({
  children,
  ordered,
  spread: false,
  type: "list",
  ...(ordered ? { start: 1 } : {}),
});

const cell = (children: PhrasingContent[]): TableCell => ({
  children,
  type: "tableCell",
});

const phr = (c: string | PhrasingContent[]): PhrasingContent[] =>
  typeof c === "string" ? [txt(c)] : c;

/** A GFM pipe table — first row is the header. Cell text may carry inline code via `icode`. */
export const table = (
  header: (string | PhrasingContent[])[],
  rows: (string | PhrasingContent[])[][]
): Table => ({
  align: null,
  children: [
    { children: header.map((h) => cell(phr(h))), type: "tableRow" },
    ...rows.map((r): TableRow => ({
      children: r.map((c) => cell(phr(c))),
      type: "tableRow",
    })),
  ],
  type: "table",
});

/* ------------------------------------------------------------------ */
/* Transform                                                           */
/* ------------------------------------------------------------------ */

export type FlowAscii = (node: MdxTarget, ctx: AsciiCtx) => RootContent[];
export type InlineAscii = (node: MdxTarget, ctx: AsciiCtx) => PhrasingContent[];

export interface AsciiEntry {
  /** Renderer for the flow (block-level) spelling of the element. */
  flow?: FlowAscii;
  /** Renderer for the inline spelling; falls back to unwrapping children. */
  text?: InlineAscii;
}

export type AsciiRegistry = Record<string, AsciiEntry>;

export interface AsciiCtx {
  /** Recursively transformed children of `node` — JSX replaced by ASCII nodes. */
  children: (node: MdxTarget | Parent) => RootContent[];
  /** Same, flattened to phrasing content for inline embedding. */
  inline: (node: MdxTarget | Parent) => PhrasingContent[];
  /** Plain text of the transformed children (labels, fence payloads). */
  text: (node: MdxTarget | Parent | Node[]) => string;
  /**
   * Serialize transformed children back to a markdown string — for raw-HTML
   * wrappers (`<details>`) whose body must arrive as text inside the node.
   */
  serialize: (children: RootContent[]) => string;
  /** Warn once per unhandled component name. */
  warn: (name: string) => void;
}

/** Phrasing node types allowed inside paragraphs. */
const PHRASING = new Set([
  "text",
  "emphasis",
  "strong",
  "delete",
  "inlineCode",
  "break",
  "link",
  "linkReference",
  "image",
  "imageReference",
  "footnote",
  "footnoteReference",
  "inlineMath",
  "html",
]);

/** Block-ish node types — used to line-break plain-text extraction. */
const BLOCK = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "list",
  "listItem",
  "code",
  "table",
  "tableRow",
  "thematicBreak",
  "html",
  "yaml",
  "math",
  "mdxJsxFlowElement",
  "containerDirective",
]);

/** Plain text of a transformed subtree — code values included verbatim. */
const deepText = (nodes: Node[]): string =>
  nodes
    .map((n): string => {
      if ("value" in n && typeof n.value === "string") {
        return n.value;
      }
      if (n.type === "image" || n.type === "imageReference") {
        return "alt" in n && typeof n.alt === "string" ? n.alt : "";
      }
      if (n.type === "break") {
        return "\n";
      }
      const inner = isParent(n) ? deepText(n.children) : "";
      return BLOCK.has(n.type) ? `${inner}\n` : inner;
    })
    .join("");

/** Flatten transformed children into phrasing content — stray blocks degrade to their text. */
const phrasing = (nodes: RootContent[]): PhrasingContent[] =>
  nodes.flatMap((n): PhrasingContent[] => {
    if (n.type === "paragraph") {
      return n.children;
    }
    if (PHRASING.has(n.type)) {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- PHRASING membership guarantees the node kind
      return [n as PhrasingContent];
    }
    const t = deepText([n]).trim();
    return t === "" ? [] : [txt(t)];
  });

/* ---------------------------- lowercase HTML ----------------------- */

/**
 * Raw HTML elements written into a document are mdxJsx elements too —
 * give the meaningful ones a markdown form (`<a>` → link, `<code>` →
 * inline code) and unwrap the rest so their text survives.
 */
const htmlEl = (
  node: MdxTarget,
  ctx: AsciiCtx,
  inline: boolean
): RootContent[] | PhrasingContent[] => {
  const name = node.name ?? "";
  const kids = (): PhrasingContent[] => phrasing(ctx.children(node));
  const blocks = (): RootContent[] => ctx.children(node);
  if (name === "a") {
    const href = attr(node, "href");
    const inner = kids();
    return href === undefined ? inner : [link(href, inner)];
  }
  if (name === "img") {
    const im: Image = {
      alt: attr(node, "alt"),
      type: "image",
      url: attr(node, "src") ?? "",
    };
    return [im];
  }
  if (name === "br") {
    return [brk()];
  }
  if (name === "strong" || name === "b") {
    return [strong(kids())];
  }
  if (name === "em" || name === "i") {
    return [em(kids())];
  }
  if (name === "del" || name === "s" || name === "strike") {
    return [del(kids())];
  }
  if (name === "code" || name === "kbd" || name === "samp") {
    return [icode(deepText(node.children ?? []))];
  }
  if (name === "hr") {
    return [thematic()];
  }
  if (name === "p") {
    return [para(kids())];
  }
  if (/^h[1-6]$/u.test(name)) {
    return [
      heading(
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the regex bounds the digit to 1-6
        Number(name[1]) as 1 | 2 | 3 | 4 | 5 | 6,
        kids()
      ),
    ];
  }
  if (name === "blockquote") {
    return [quote(blocks())];
  }
  if (name === "pre") {
    return [pre(deepText(node.children ?? []))];
  }
  if (name === "ul" || name === "ol") {
    const items = els(node, "li").map((li) =>
      item([para(phrasing(ctx.children(li)))])
    );
    return items.length === 0 ? blocks() : [list(items, name === "ol")];
  }
  return inline ? kids() : blocks();
};

/** Replace every mdxJsx element under `root` with its ASCII representation. */
export const transformAscii = (
  root: Parent,
  registry: AsciiRegistry,
  serialize: (children: RootContent[]) => string,
  warn: (name: string) => void
): void => {
  const transformElement = (n: Node, ctx: AsciiCtx): RootContent[] => {
    if (isMdxEl(n)) {
      const name = n.name ?? "";
      const entry = own(registry, name);
      if (entry === undefined) {
        // Lowercase tags are raw HTML; unknown components unwrap.
        if (/^[a-z]/u.test(name)) {
          return htmlEl(n, ctx, n.type === "mdxJsxTextElement");
        }
        warn(name);
        return ctx.children(n);
      }
      if (n.type === "mdxJsxTextElement") {
        const out =
          entry.text?.(n, ctx) ??
          phrasing(entry.flow?.(n, ctx) ?? ctx.children(n));
        return out;
      }
      if (entry.flow !== undefined) {
        return entry.flow(n, ctx);
      }
      const inlineOut = entry.text?.(n, ctx);
      return inlineOut === undefined ? ctx.children(n) : [para(inlineOut)];
    }
    if (isParent(n)) {
      n.children = ctx.children(n);
    }
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- inputs are root children by construction
    return [n as RootContent];
  };
  const transformNodes = (nodes: Node[], ctx: AsciiCtx): RootContent[] =>
    nodes.flatMap((node): RootContent[] => {
      const id: unknown = isRecord(node.data)
        ? node.data.mdxrReferenceId
        : undefined;
      const output = transformElement(node, ctx);
      if (typeof id !== "string") {
        return output;
      }
      const escaped = id
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
      return [{ type: "html", value: `<a id="${escaped}"></a>` }, ...output];
    });

  const ctx: AsciiCtx = {
    children: (node) => transformNodes(node.children ?? [], ctx),
    inline: (node) => phrasing(transformNodes(node.children ?? [], ctx)),
    serialize,
    text: (node) =>
      deepText(
        transformNodes(Array.isArray(node) ? node : (node.children ?? []), ctx)
      ).trim(),
    warn,
  };

  root.children = transformNodes(root.children, ctx);
};

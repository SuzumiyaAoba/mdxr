/** ASCII renderers for document scaffolding components. */

import type { PhrasingContent, RootContent } from "mdast";

import { nonEmpty } from "../guards.js";
import {
  attr,
  em,
  heading,
  html,
  icode,
  link,
  para,
  quote,
  strong,
  textOf,
  txt,
} from "./ast.js";
import type { AsciiCtx, AsciiRegistry, MdxTarget } from "./ast.js";

/** `Date: x · Owner: y` — labeled meta pairs, skipping absent attrs. */
const metaLine = (
  node: MdxTarget,
  keys: [string, string][]
): PhrasingContent[] => {
  const parts = keys.flatMap(([k, label]): PhrasingContent[] => {
    const v = attr(node, k);
    return v === undefined ? [] : [txt(`${label}: ${v}`)];
  });
  return parts.flatMap((p, i) => (i === 0 ? [p] : [txt(" · "), p]));
};

const META_KEYS: [string, string][] = [
  ["date", "Date"],
  ["owner", "Owner"],
  ["version", "Version"],
  ["updated", "Updated"],
];

/* GitHub chips — same URL rules as ui/ref.tsx (o/r → github.com, host/o/r or
 * full URL → that host). */

const REPO_SEG = /^[\w.-]+$/u;

const repoBase = (repo: string): string => {
  const r = repo.replace(/\/+$/u, "");
  if (r.includes("://")) {
    return /^https?:\/\//iu.test(r) ? r : `https://github.com/${r}`;
  }
  const segs = r.split("/");
  return segs.every((s) => REPO_SEG.test(s)) && segs.length > 2
    ? `https://${r}`
    : `https://github.com/${r}`;
};

const ghChip = (
  kind: "issues" | "pull" | "commit",
  node: MdxTarget,
  ctx: AsciiCtx
): PhrasingContent[] => {
  const repo = attr(node, "repo") ?? "";
  const id =
    kind === "commit"
      ? (attr(node, "sha") ?? "")
      : (attr(node, "number") ?? "");
  const shown = kind === "commit" ? id.slice(0, 7) : `#${id}`;
  const href = attr(node, "href") ?? `${repoBase(repo)}/${kind}/${id}`;
  const label = kind === "commit" ? `${repo}@${shown}` : `${repo}${shown}`;
  const children = ctx.inline(node);
  return [
    link(href, [icode(label)]),
    ...(children.length === 0 ? [] : [txt(" "), ...children]),
  ];
};

/** `**name** — definition` for Glossary terms. */
const term = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => [
  para([
    strong([txt(attr(node, "name") ?? "")]),
    ...(ctx.inline(node).length === 0 ? [] : [txt(" — "), ...ctx.inline(node)]),
  ]),
];

/** `<details>` html passthrough — inner markdown must be re-serialized. */
const details = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const summary = attr(node, "summary") ?? "Details";
  const body = ctx.serialize(ctx.children(node)).trim();
  return [
    html(`<details>\n<summary>${summary}</summary>\n\n${body}\n\n</details>`),
  ];
};

export const documentRenderers: AsciiRegistry = {
  Callout: {
    flow: (n, ctx) => {
      const kind = (attr(n, "kind") ?? "note").toUpperCase();
      const title = attr(n, "title");
      const head: PhrasingContent[] = [txt(`[!${kind}]`)];
      if (nonEmpty(title)) {
        head.push(txt(" "), strong([txt(title)]));
      }
      return [quote([para(head), ...ctx.children(n)])];
    },
  },
  Cmd: { text: (n, ctx) => [icode(ctx.text(n))] },
  CodeFile: {
    // remarkCodeFile expands flow uses into real code nodes; an inline
    // spelling degrades to the path chip.
    text: (n) => [icode(attr(n, "path") ?? "")],
  },
  Commit: { text: (n, ctx) => ghChip("commit", n, ctx) },
  Details: { flow: details },
  Figure: {
    flow: (n, ctx) => {
      const caption = attr(n, "caption") ?? ctx.text(n);
      return [
        para([
          {
            alt: attr(n, "alt") ?? caption,
            type: "image",
            url: attr(n, "src") ?? "",
          },
        ]),
        ...(nonEmpty(caption) ? [para([em([txt(caption)])])] : []),
      ];
    },
  },
  FileRef: {
    text: (n) => {
      const p = attr(n, "path") ?? "";
      const l = attr(n, "lines");
      return [icode(l === undefined ? p : `${p}:${l}`)];
    },
  },
  Glossary: { flow: (n, ctx) => ctx.children(n) },
  Icon: {
    text: (n) => {
      const label = attr(n, "label");
      return nonEmpty(label) ? [icode(`[${label}]`)] : [];
    },
  },
  Issue: { text: (n, ctx) => ghChip("issues", n, ctx) },
  Meta: {
    flow: (n, ctx) => {
      const head = metaLine(n, META_KEYS);
      const segs = ctx
        .children(n)
        .map((c) => textOf(c).trim())
        .filter(nonEmpty);
      const items = segs.flatMap((s, i): PhrasingContent[] =>
        i === 0 ? [txt(s)] : [txt(" · "), txt(s)]
      );
      if (head.length === 0) {
        return items.length === 0 ? [] : [para(items)];
      }
      return [
        para([...head, ...(items.length === 0 ? [] : [txt(" · "), ...items])]),
      ];
    },
  },
  MetaItem: {
    text: (n, ctx) => [
      strong([txt(attr(n, "label") ?? "")]),
      txt(": "),
      ...ctx.inline(n),
    ],
  },
  PR: { text: (n, ctx) => ghChip("pull", n, ctx) },
  Plan: {
    flow: (n, ctx) => {
      const title = attr(n, "title") ?? "";
      const meta = metaLine(n, [["status", "Status"], ...META_KEYS]);
      return [
        heading(1, [txt(title)]),
        ...(meta.length === 0 ? [] : [para(meta)]),
        ...ctx.children(n),
      ];
    },
  },
  Ref: {
    flow: (n, ctx) => [
      para([
        link(attr(n, "href") ?? "", [strong([txt(attr(n, "title") ?? "")])]),
        ...(ctx.inline(n).length === 0 ? [] : [txt(" — "), ...ctx.inline(n)]),
      ]),
    ],
  },
  SymbolRef: {
    text: (n) => {
      const name = attr(n, "name") ?? "";
      const path = attr(n, "path");
      const lines = attr(n, "lines");
      const at =
        path === undefined
          ? ""
          : ` (${path}${lines === undefined ? "" : `:${lines}`})`;
      return [icode(name), ...(at === "" ? [] : [txt(at)])];
    },
  },
  Term: { flow: term },
  Toc: {
    flow: (n, ctx) => [
      para([strong([txt(attr(n, "title") ?? "Contents")])]),
      ...ctx.children(n),
    ],
  },
};

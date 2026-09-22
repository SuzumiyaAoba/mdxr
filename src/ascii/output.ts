/** ASCII renderers for output-artifact components (diffs, graphs, reports). */

import type { PhrasingContent, RootContent } from "mdast";

import { nonEmpty } from "../guards.js";
import {
  attr,
  del,
  els,
  flag,
  html,
  icode,
  item,
  list,
  num,
  para,
  pre,
  quote,
  strong,
  table,
  txt,
  withoutEls,
} from "./ast.js";
import type { AsciiCtx, AsciiRegistry, MdxTarget } from "./ast.js";
import { pad, statusIcon } from "./glyphs.js";
import { caption, statusItem, suffix } from "./parts.js";

/* ------------------------------ comment ---------------------------- */

/** `<Comment>` — shared by Review (severity card) and Comments (thread). */
const comment = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const sev = attr(node, "severity");
  const title = attr(node, "title");
  const author = attr(node, "author");
  const file = attr(node, "file");
  const lines = attr(node, "lines");
  const side = attr(node, "side");
  const head: PhrasingContent[] = [
    ...(nonEmpty(sev) ? [icode(sev.toUpperCase()), txt(" ")] : []),
    ...(nonEmpty(title) ? [strong([txt(title)])] : []),
  ];
  let where: string | undefined;
  if (nonEmpty(file)) {
    where = `${file}${nonEmpty(lines) ? `:${lines}` : ""}`;
  } else if (nonEmpty(lines)) {
    where = `lines ${lines}`;
  }
  const meta = [
    nonEmpty(author) ? author : undefined,
    where,
    nonEmpty(side) && side !== "new" ? side : undefined,
  ]
    .filter(nonEmpty)
    .join(" · ");
  if (meta !== "") {
    head.push(txt(` — ${meta}`));
  }
  return [
    quote([...(head.length === 0 ? [] : [para(head)]), ...ctx.children(node)]),
  ];
};

/* ------------------------------- graph ----------------------------- */

const graph = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const nodes = els(node, "Node");
  const edges = els(node, "Edge");
  const connected = new Set(
    edges.flatMap((edge) => [attr(edge, "from"), attr(edge, "to")])
  );
  const nodeNotes = nodes.flatMap((nd) => {
    const label = attr(nd, "label");
    const note = attr(nd, "note");
    const path = attr(nd, "path");
    const status = attr(nd, "status");
    if (
      (label === undefined || label === attr(nd, "id")) &&
      note === undefined &&
      path === undefined &&
      status === undefined &&
      connected.has(attr(nd, "id"))
    ) {
      return [];
    }
    const head: PhrasingContent[] = [
      icode(attr(nd, "id") ?? ""),
      txt(" = "),
      strong([txt(label ?? attr(nd, "id") ?? "")]),
      ...suffix([
        note,
        nonEmpty(path)
          ? `${path}${nonEmpty(attr(nd, "lines")) ? `:${attr(nd, "lines")}` : ""}`
          : undefined,
        status,
        flag(nd, "external") ? "external" : undefined,
      ]),
    ];
    return [item([para(head)])];
  });
  const edgeItems = edges.map((e) => {
    const kind = attr(e, "kind");
    const label = attr(e, "label");
    return item([
      para([
        icode(attr(e, "from") ?? ""),
        txt(" → "),
        icode(attr(e, "to") ?? ""),
        ...suffix([kind, label]),
      ]),
    ]);
  });
  // Everything except the Node/Edge elements keeps its own rendering.
  const rest = ctx.children(withoutEls(node, ["Node", "Edge"]));
  return [
    ...caption(attr(node, "title")),
    ...(nodeNotes.length > 0 || edgeItems.length > 0
      ? [list([...nodeNotes, ...edgeItems])]
      : []),
    ...rest,
  ];
};

/* ------------------------------- tests ------------------------------ */

const tally = (
  entries: MdxTarget[],
  key: string,
  extra?: (els: MdxTarget[]) => string | undefined
): string => {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const s = (attr(e, key) ?? "").toLowerCase();
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const parts = [...counts.entries()]
    .filter(([s]) => s !== "")
    .map(([s, n]) => `${n} ${s}`);
  const x = extra?.(entries);
  if (nonEmpty(x)) {
    parts.push(x);
  }
  return parts.length === 0 ? "" : ` — ${parts.join(" · ")}`;
};

const DURATION_RE = /^(?<v>\d+(?:\.\d+)?)(?<unit>ms|s|m|h)$/u;

const UNIT_MS: Record<string, number> = {
  h: 3_600_000,
  m: 60_000,
  ms: 1,
  s: 1000,
};

const durationSum = (entries: MdxTarget[]): string | undefined => {
  let ms = 0;
  let seen = false;
  for (const e of entries) {
    const m = DURATION_RE.exec((attr(e, "duration") ?? "").trim());
    if (m?.groups === undefined) {
      continue;
    }
    seen = true;
    ms += Number(m.groups.v) * (UNIT_MS[m.groups.unit ?? ""] ?? 1);
  }
  if (!seen) {
    return undefined;
  }
  return ms >= 1000 ? `${Math.round(ms / 100) / 10}s` : `${Math.round(ms)}ms`;
};

const tests = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const cases = els(node, "Test");
  const sum = durationSum(cases);
  return [
    ...caption(
      attr(node, "title"),
      `${nonEmpty(attr(node, "tool")) ? ` (${attr(node, "tool")})` : ""}${tally(cases, "status")}${nonEmpty(sum) ? ` · ${sum}` : ""}`
    ),
    list(
      cases.map((t) =>
        statusItem(
          attr(t, "status"),
          [
            txt(attr(t, "name") ?? ""),
            ...suffix([
              attr(t, "duration"),
              nonEmpty(attr(t, "file"))
                ? `${attr(t, "file")}${nonEmpty(attr(t, "lines")) ? `:${attr(t, "lines")}` : ""}`
                : undefined,
            ]),
          ],
          ctx.children(t)
        )
      )
    ),
    ...ctx.children(withoutEls(node, ["Test"])),
  ];
};

/* ----------------------------- endpoints ---------------------------- */

const endpoints = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const base = attr(node, "base") ?? "";
  const rows = els(node, "Endpoint").map((e) => {
    const method = (attr(e, "method") ?? "").toUpperCase();
    const path = `${base}${attr(e, "path") ?? ""}`;
    const flags = [
      nonEmpty(attr(e, "auth")) ? `auth: ${attr(e, "auth")}` : undefined,
      flag(e, "deprecated") ? "deprecated" : undefined,
    ]
      .filter(nonEmpty)
      .join(" · ");
    return [[icode(method)], [icode(path)], flags, ctx.text(e)];
  });
  return [
    ...caption(attr(node, "title")),
    table(["method", "path", "flags", "description"], rows),
    ...ctx.children(withoutEls(node, ["Endpoint"])),
  ];
};

/* -------------------------------- json ------------------------------ */

const json = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const value = attr(node, "value");
  let raw = value ?? "";
  if (!nonEmpty(raw)) {
    // A fenced ```json child carries the payload.
    const codeNode = (node.children ?? []).find((c) => c.type === "code");
    raw =
      codeNode !== undefined && "value" in codeNode
        ? String(codeNode.value)
        : ctx.text(node);
  }
  let pretty = raw;
  try {
    pretty = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    // Keep the raw text — a bad payload shouldn't kill the text render.
  }
  return [...caption(attr(node, "title")), pre(pretty, "json")];
};

/* ----------------------------- waterfall ---------------------------- */

const waterfall = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const spans = els(node, "Span").map((s) => ({
    duration: num(s, "duration") ?? 0,
    durationRaw: attr(s, "duration") ?? "",
    name: attr(s, "name") ?? "",
    note: attr(s, "note"),
    start: num(s, "start") ?? 0,
  }));
  if (spans.length === 0) {
    return ctx.children(node);
  }
  const total =
    num(node, "total") ?? Math.max(...spans.map((s) => s.start + s.duration));
  const unit = attr(node, "unit") ?? "ms";
  const W = 40;
  const nameW = Math.min(24, Math.max(8, ...spans.map((s) => s.name.length)));
  const lines: string[] = [];
  const title = attr(node, "title");
  if (nonEmpty(title)) {
    lines.push(`${title}  (0 → ${total}${unit})`);
  }
  for (const s of spans) {
    const scale = Math.max(1, total);
    const from = Math.max(0, Math.min(W, Math.round((s.start / scale) * W)));
    const to = Math.max(
      from,
      Math.min(W, Math.round(((s.start + Math.max(0, s.duration)) / scale) * W))
    );
    const cells = `${" ".repeat(from)}${"█".repeat(to - from)}`;
    lines.push(
      `${pad(s.name, nameW)} ${cells} ${s.durationRaw || `${s.duration}${unit}`}${nonEmpty(s.note) ? `  ${s.note}` : ""}`
    );
  }
  return [pre(lines.join("\n")), ...ctx.children(withoutEls(node, ["Span"]))];
};

/* ----------------------------- registry ----------------------------- */

export const outputRenderers: AsciiRegistry = {
  Comment: { flow: comment },
  Comments: { flow: (n, ctx) => ctx.children(n) },
  Del: { text: (n, ctx) => [del(ctx.inline(n))] },
  Edge: {
    flow: (n) => [
      para([
        icode(attr(n, "from") ?? ""),
        txt(" → "),
        icode(attr(n, "to") ?? ""),
        ...suffix([attr(n, "kind"), attr(n, "label")]),
      ]),
    ],
    text: (n) => [
      icode(attr(n, "from") ?? ""),
      txt(" → "),
      icode(attr(n, "to") ?? ""),
    ],
  },
  Endpoint: {
    flow: (n, ctx) => [
      para([
        icode((attr(n, "method") ?? "").toUpperCase()),
        txt(" "),
        icode(attr(n, "path") ?? ""),
        ...suffix([
          nonEmpty(attr(n, "auth")) ? `auth: ${attr(n, "auth")}` : undefined,
          flag(n, "deprecated") ? "deprecated" : undefined,
        ]),
        ...(ctx.inline(n).length === 0 ? [] : [txt(" — "), ...ctx.inline(n)]),
      ]),
    ],
  },
  Endpoints: { flow: endpoints },
  Graph: { flow: graph },
  Ins: {
    text: (n, ctx) => [html("<ins>"), ...ctx.inline(n), html("</ins>")],
  },
  Json: { flow: json },
  Node: {
    flow: (n) => [
      para([
        icode(attr(n, "id") ?? ""),
        ...(nonEmpty(attr(n, "label")) ? [txt(` = ${attr(n, "label")}`)] : []),
        ...suffix([attr(n, "note"), attr(n, "status")]),
      ]),
    ],
    text: (n) => [icode(attr(n, "id") ?? "")],
  },
  Span: {
    flow: (n) => [
      para([
        icode(attr(n, "name") ?? ""),
        ...suffix([attr(n, "duration"), attr(n, "note")]),
      ]),
    ],
  },
  Test: {
    flow: (n, ctx) => [
      para([
        txt(`${statusIcon(attr(n, "status"))} `),
        txt(attr(n, "name") ?? ""),
        ...suffix([attr(n, "duration"), attr(n, "file")]),
      ]),
      ...ctx.children(n),
    ],
  },
  Tests: { flow: tests },
  Waterfall: { flow: waterfall },
};

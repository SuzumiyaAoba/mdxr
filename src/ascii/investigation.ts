/** ASCII renderers for code-investigation components. */

import type { ListItem, PhrasingContent, RootContent } from "mdast";
import type { Node, Parent } from "unist";

import { nonEmpty } from "../guards.js";
import { isParent } from "../remark/ast.js";
import {
  attr,
  els,
  flag,
  icode,
  item,
  list,
  para,
  pre,
  strong,
  table,
  textOf,
  txt,
  withoutEls,
} from "./ast.js";
import type { AsciiCtx, AsciiRegistry, MdxTarget } from "./ast.js";
import { statusIcon } from "./glyphs.js";
import { caption, suffix } from "./parts.js";

/** `path:lines` in code font, or just `path`. */
const pathAt = (node: MdxTarget, key = "path"): string => {
  const p = attr(node, key) ?? "";
  const l = attr(node, "lines");
  return l === undefined ? p : `${p}:${l}`;
};

/** Ordered, numbered entry `1. `CONFIDENCE` **title**` + children. */
const numbered = (
  entries: MdxTarget[],
  statusKey: string,
  ctx: AsciiCtx
): RootContent =>
  list(
    entries.map((e) =>
      item([
        para([
          icode((attr(e, statusKey) ?? "").toUpperCase()),
          ...(nonEmpty(attr(e, "title"))
            ? [txt(" "), strong([txt(attr(e, "title") ?? "")])]
            : []),
          ...(ctx.inline(e).length === 0 ? [] : [txt(" — "), ...ctx.inline(e)]),
        ]),
      ])
    ),
    true
  );

/* ------------------------------ tree ------------------------------- */

const NOTE_RE = /\s+(?:—|#)\s+/u;
const PLACEHOLDER_RE = /^(?:\.{3}|…)$/u;

interface TreeEntry {
  children: TreeEntry[];
  name: string;
  note?: string;
}

const treeEntry = (node: Parent, children: TreeEntry[]): TreeEntry => {
  const label = node.children
    .filter((child) => child.type !== "list")
    .map(textOf)
    .join("")
    .trim();
  const note = NOTE_RE.exec(label);
  return {
    children,
    name: (note === null ? label : label.slice(0, note.index)).trim(),
    ...(note === null
      ? {}
      : { note: label.slice(note.index + note[0].length).trim() }),
  };
};

const treeEntries = (nodes: Node[]): TreeEntry[] =>
  nodes.flatMap((node) => {
    if (!isParent(node)) {
      return [];
    }
    if (node.type === "list") {
      return node.children
        .filter(
          (child): child is Parent =>
            child.type === "listItem" && isParent(child)
        )
        .map((child) =>
          treeEntry(
            child,
            treeEntries(
              child.children.filter((nested) => nested.type === "list")
            )
          )
        );
    }
    return treeEntries(node.children);
  });

const treeLines = (entries: TreeEntry[], prefix: string): string[] =>
  entries.flatMap((e, i) => {
    const last = i === entries.length - 1;
    const name = PLACEHOLDER_RE.test(e.name) ? "…" : e.name;
    const line = `${prefix}${last ? "└── " : "├── "}${name}${
      e.note === undefined || e.note === "" ? "" : ` — ${e.note}`
    }`;
    return [
      line,
      ...treeLines(e.children, `${prefix}${last ? "    " : "│   "}`),
    ];
  });

const tree = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const entries = treeEntries(node.children ?? []);
  const root = attr(node, "root");
  const lines = [...(nonEmpty(root) ? [root] : []), ...treeLines(entries, "")];
  // The markdown list fed into treeEntries is consumed — keep only prose.
  const rest = (node.children ?? []).filter((c) => c.type !== "list");
  return [pre(lines.join("\n")), ...ctx.children({ ...node, children: rest })];
};

/* ---------------------------- terminal ------------------------------ */

const terminal = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const cmd = attr(node, "cmd");
  const exit = attr(node, "exit");
  const body = ctx.text(node);
  const lines = [
    ...(nonEmpty(cmd) ? [`$ ${cmd}`] : []),
    ...(body === "" ? [] : [body]),
    ...(nonEmpty(exit) ? [`exit ${exit}`] : []),
  ];
  return [...caption(attr(node, "title")), pre(lines.join("\n"), "console")];
};

/* ----------------------------- registry ---------------------------- */

export const investigationRenderers: AsciiRegistry = {
  Change: {
    flow: (n, ctx) => [
      para([
        strong([txt(attr(n, "kind") ?? "modify")]),
        txt(" "),
        icode(attr(n, "path") ?? ""),
        ...(nonEmpty(attr(n, "to"))
          ? [txt(" → "), icode(attr(n, "to") ?? "")]
          : []),
        ...(ctx.inline(n).length === 0 ? [] : [txt(" — "), ...ctx.inline(n)]),
      ]),
    ],
  },
  Changes: {
    flow: (n, ctx) => [
      list(
        els(n, "Change").map((c) => {
          const kind = (attr(c, "kind") ?? "modify").toLowerCase();
          const head: PhrasingContent[] =
            kind === "rename"
              ? [
                  strong([txt("rename")]),
                  txt(" "),
                  icode(attr(c, "path") ?? ""),
                  txt(" → "),
                  icode(attr(c, "to") ?? ""),
                ]
              : [strong([txt(kind)]), txt(" "), icode(attr(c, "path") ?? "")];
          return item([
            para([
              ...head,
              ...(ctx.inline(c).length === 0
                ? []
                : [txt(" — "), ...ctx.inline(c)]),
            ]),
          ]);
        })
      ),
      ...ctx.children(withoutEls(n, ["Change"])),
    ],
  },
  Dep: {
    flow: (n) => [
      para([
        icode(attr(n, "from") ?? ""),
        txt(" → "),
        icode(attr(n, "to") ?? ""),
        ...suffix([attr(n, "kind")]),
      ]),
    ],
  },
  Deps: {
    flow: (n, ctx) => [
      ...caption(attr(n, "title")),
      list(
        els(n, "Dep").map((d) =>
          item([
            para([
              icode(attr(d, "from") ?? ""),
              txt(" → "),
              icode(attr(d, "to") ?? ""),
              ...suffix([attr(d, "kind")]),
              ...(ctx.inline(d).length === 0
                ? []
                : [txt(" — "), ...ctx.inline(d)]),
            ]),
          ])
        )
      ),
      ...ctx.children(withoutEls(n, ["Dep"])),
    ],
  },
  File: {
    flow: (n, ctx) => [
      para([
        icode(pathAt(n)),
        ...suffix([attr(n, "kind")]),
        ...(ctx.inline(n).length === 0 ? [] : [txt(" — "), ...ctx.inline(n)]),
      ]),
    ],
  },
  Files: {
    flow: (n, ctx) => [
      ...caption(attr(n, "title")),
      list(
        els(n, "File").map((f) =>
          item([
            para([
              icode(pathAt(f)),
              ...suffix([attr(f, "kind")]),
              ...(ctx.inline(f).length === 0
                ? []
                : [txt(" — "), ...ctx.inline(f)]),
            ]),
          ])
        )
      ),
      ...ctx.children(withoutEls(n, ["File"])),
    ],
  },
  Finding: {
    flow: (n, ctx) => [
      para([
        icode((attr(n, "confidence") ?? "").toUpperCase()),
        ...(nonEmpty(attr(n, "title"))
          ? [txt(" "), strong([txt(attr(n, "title") ?? "")])]
          : []),
      ]),
      ...ctx.children(n),
    ],
  },
  Findings: {
    flow: (n, ctx) => [
      ...caption(attr(n, "title")),
      numbered(els(n, "Finding"), "confidence", ctx),
      ...ctx.children(withoutEls(n, ["Finding"])),
    ],
  },
  Flow: {
    flow: (n, ctx) => [
      ...caption(attr(n, "title")),
      list(
        els(n, "FlowStep").map((s) =>
          item([
            para([
              icode(attr(s, "name") ?? ""),
              ...(nonEmpty(attr(s, "path"))
                ? [txt(` — `), icode(pathAt(s))]
                : []),
            ]),
            ...ctx.children(s),
          ])
        ),
        true
      ),
      ...ctx.children(withoutEls(n, ["FlowStep"])),
    ],
  },
  FlowStep: {
    flow: (n, ctx) => [
      para([
        icode(attr(n, "name") ?? ""),
        ...(nonEmpty(attr(n, "path")) ? [txt(" — "), icode(pathAt(n))] : []),
        ...(ctx.inline(n).length === 0 ? [] : [txt(": "), ...ctx.inline(n)]),
      ]),
    ],
  },
  Hypotheses: {
    flow: (n, ctx) => [
      ...caption(attr(n, "title")),
      list(
        els(n, "Hypothesis").map((h): ListItem => {
          const status = (attr(h, "status") ?? "untested").toLowerCase();
          return item(
            [
              para([
                txt(`${statusIcon(status)} `),
                ...(nonEmpty(attr(h, "title"))
                  ? [strong([txt(attr(h, "title") ?? "")])]
                  : []),
                ...(ctx.inline(h).length === 0
                  ? []
                  : [txt(" — "), ...ctx.inline(h)]),
              ]),
            ],
            status === "supported" ? true : undefined
          );
        })
      ),
      ...ctx.children(withoutEls(n, ["Hypothesis"])),
    ],
  },
  Hypothesis: {
    flow: (n, ctx) => [
      para([
        txt(`${statusIcon(attr(n, "status"))} `),
        ...(nonEmpty(attr(n, "title"))
          ? [strong([txt(attr(n, "title") ?? "")])]
          : []),
      ]),
      ...ctx.children(n),
    ],
  },
  Prop: {
    flow: (n, ctx) => [
      para([
        icode(attr(n, "name") ?? ""),
        ...suffix([attr(n, "type")]),
        ...(ctx.inline(n).length === 0 ? [] : [txt(" — "), ...ctx.inline(n)]),
      ]),
    ],
  },
  Props: {
    flow: (n, ctx) => [
      ...caption(attr(n, "of")),
      table(
        ["prop", "type", "required", "default", "description"],
        els(n, "Prop").map((p) => [
          attr(p, "name") ?? "",
          attr(p, "type") ?? "",
          flag(p, "required") ? "yes" : "",
          attr(p, "default") ?? "",
          ctx.text(p),
        ])
      ),
      ...ctx.children(withoutEls(n, ["Prop"])),
    ],
  },
  Search: {
    flow: (n, ctx) => [
      para([
        icode(attr(n, "pattern") ?? ""),
        ...suffix([
          nonEmpty(attr(n, "path")) ? `in ${attr(n, "path")}` : undefined,
          attr(n, "tool"),
          nonEmpty(attr(n, "hits")) ? `${attr(n, "hits")} hits` : undefined,
        ]),
        ...(ctx.inline(n).length === 0 ? [] : [txt(" — "), ...ctx.inline(n)]),
      ]),
    ],
  },
  Searches: {
    flow: (n, ctx) => [
      ...caption(attr(n, "title")),
      list(
        els(n, "Search").map((s) =>
          item([
            para([
              icode(attr(s, "pattern") ?? ""),
              ...suffix([
                nonEmpty(attr(s, "path")) ? `in ${attr(s, "path")}` : undefined,
                attr(s, "tool"),
                nonEmpty(attr(s, "hits"))
                  ? `${attr(s, "hits")} hits`
                  : undefined,
              ]),
              ...(ctx.inline(s).length === 0
                ? []
                : [txt(" — "), ...ctx.inline(s)]),
            ]),
          ])
        )
      ),
      ...ctx.children(withoutEls(n, ["Search"])),
    ],
  },
  Terminal: { flow: terminal },
  Trace: {
    flow: (n, ctx) => {
      const frames = els(n, "TraceFrame");
      const error = attr(n, "error");
      const lines = [
        ...(nonEmpty(error) ? [error] : []),
        ...frames.flatMap((f, i) => {
          const kind = attr(f, "kind");
          const head = `#${i} ${attr(f, "name") ?? ""}${
            nonEmpty(attr(f, "path")) ? ` — ${pathAt(f)}` : ""
          }${kind === "lib" ? " (lib)" : ""}`;
          const note = ctx.text(f);
          return note === "" ? [head] : [head, `    ↳ ${note}`];
        }),
      ];
      return [
        ...caption(attr(n, "title")),
        pre(lines.join("\n")),
        ...ctx.children(withoutEls(n, ["TraceFrame"])),
      ];
    },
  },
  TraceFrame: {
    flow: (n, ctx) => [
      para([
        icode(attr(n, "name") ?? ""),
        ...(nonEmpty(attr(n, "path")) ? [txt(" — "), icode(pathAt(n))] : []),
        ...(ctx.inline(n).length === 0 ? [] : [txt(": "), ...ctx.inline(n)]),
      ]),
    ],
  },
  Tree: { flow: tree },
};

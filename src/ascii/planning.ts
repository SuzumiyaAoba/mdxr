/** ASCII renderers for planning & status components. */

import type { ListItem, PhrasingContent, RootContent } from "mdast";
import type { Node } from "unist";

import { nonEmpty } from "../guards.js";
import { isParent } from "../remark/ast.js";
import {
  attr,
  els,
  em,
  flag,
  heading,
  icode,
  item,
  list,
  num,
  para,
  pre,
  strong,
  table,
  textOf,
  txt,
  withoutEls,
} from "./ast.js";
import type { AsciiCtx, AsciiRegistry, MdxTarget } from "./ast.js";
import { bar, pad, statusIcon } from "./glyphs.js";
import { caption, joined, suffix } from "./parts.js";

/* ---------------------------- small helpers ------------------------ */

/** `owner` attr → a normalized `@name` chip (leading `@`s collapsed). */
const ownerChip = (node: MdxTarget): string | undefined => {
  const owner = attr(node, "owner");
  return nonEmpty(owner) ? `@${owner.replace(/^@+/u, "")}` : undefined;
};

/** Attr → `@owner`-style chip strings shared by task/card rows. */
const chipParts = (node: MdxTarget): (string | undefined)[] => {
  const owner = attr(node, "owner");
  const effort = attr(node, "effort");
  const priority = attr(node, "priority");
  const due = attr(node, "due");
  return [
    nonEmpty(owner) ? `@${owner.replace(/^@+/u, "")}` : undefined,
    nonEmpty(effort) ? effort.toUpperCase() : undefined,
    nonEmpty(priority) ? priority.toUpperCase() : undefined,
    nonEmpty(due) ? `due: ${due}` : undefined,
  ];
};

/**
 * Statused list item: `[x]`/`[ ]` real checkboxes for done/todo, a glyph
 * (`◐`/`✗`) for doing/blocked so four-state lists stay readable.
 */
const statusItem = (
  status: string | undefined,
  head: PhrasingContent[],
  children: RootContent[]
): ListItem => {
  const s = (status ?? "").toLowerCase();
  let checked: boolean | undefined;
  if (s === "done" || s === "pass") {
    checked = true;
  } else if (s === "todo") {
    checked = false;
  }
  return item(
    [
      para([
        ...(checked === undefined ? [txt(`${statusIcon(s)} `)] : []),
        ...head,
      ]),
      ...children,
    ],
    checked
  );
};

/** The approval status words mapped onto the four-state icons. */
const approvalStatus = (s: string | undefined): string => {
  const k = (s ?? "").toLowerCase();
  if (k === "approved") {
    return "done";
  }
  if (k === "rejected" || k === "changes-requested") {
    return "fail";
  }
  return "todo";
};

/* ------------------------------ gantt ------------------------------ */

const DAY_MS = 86_400_000;

const dayOf = (iso: string | undefined): number | undefined => {
  if (iso === undefined) {
    return undefined;
  }
  const t = Date.parse(iso);
  return Number.isNaN(t) ? undefined : Math.floor(t / DAY_MS);
};

const TASK_CHAR: Record<string, string> = {
  blocked: "▒",
  doing: "▓",
  done: "█",
  todo: "░",
};

const gantt = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const tasks = els(node, "Task").flatMap((t) => {
    const start = dayOf(attr(t, "start"));
    return start === undefined
      ? []
      : [
          {
            el: t,
            end: dayOf(attr(t, "end")) ?? start,
            name: attr(t, "name") ?? "",
            progress: num(t, "progress"),
            start,
            status: (attr(t, "status") ?? "todo").toLowerCase(),
          },
        ];
  });
  const milestones = els(node, "Milestone").flatMap((m) => {
    const date = dayOf(attr(m, "date"));
    return date === undefined
      ? []
      : [
          {
            date,
            el: m,
            name: attr(m, "name") ?? "",
          },
        ];
  });
  if (tasks.length === 0 && milestones.length === 0) {
    return ctx.children(node);
  }

  const lo =
    dayOf(attr(node, "start")) ??
    Math.min(...tasks.map((t) => t.start), ...milestones.map((m) => m.date));
  const hi =
    dayOf(attr(node, "end")) ??
    Math.max(
      ...tasks.map((t) => t.end + 1),
      ...milestones.map((m) => m.date + 1)
    );
  const span = Math.max(1, hi - lo);
  const W = 40;
  const at = (day: number): number =>
    Math.max(0, Math.min(W, Math.round(((day - lo) / span) * W)));

  const nameW = Math.min(
    24,
    Math.max(
      8,
      ...tasks.map((t) => t.name.length),
      ...milestones.map((m) => m.name.length)
    )
  );
  const iso = (d: number): string =>
    new Date(d * DAY_MS).toISOString().slice(0, 10);
  const lines: string[] = [];
  const title = attr(node, "title");
  if (nonEmpty(title)) {
    lines.push(title);
  }
  lines.push(`${pad("", nameW)} ${iso(lo)} → ${iso(hi)}`);
  for (const t of tasks) {
    const from = at(t.start);
    const to = Math.max(from + 1, at(t.end + 1));
    const cells = Array.from({ length: W }, (_, i) => {
      if (i < from || i >= to) {
        return " ";
      }
      const ch = TASK_CHAR[t.status] ?? "░";
      if (t.progress === undefined || t.progress <= 0) {
        return ch;
      }
      return i - from < ((to - from) * Math.min(100, t.progress)) / 100
        ? "█"
        : ch;
    }).join("");
    const owner = attr(t.el, "owner");
    const tail = joined([
      nonEmpty(owner) ? `@${owner.replace(/^@+/u, "")}` : undefined,
      attr(t.el, "note"),
    ]);
    lines.push(
      `${pad(t.name, nameW)} ${cells}${tail === "" ? "" : `  ${tail}`}`
    );
  }
  for (const m of milestones) {
    const cells = Array.from({ length: W }, (_, i) =>
      i === at(m.date) ? "◆" : " "
    ).join("");
    const tail = joined([attr(m.el, "status"), attr(m.el, "note")]);
    lines.push(
      `${pad(m.name, nameW)} ${cells}${tail === "" ? "" : `  ${tail}`}`
    );
  }
  return [
    pre(lines.join("\n")),
    ...ctx.children(withoutEls(node, ["Task", "Milestone"])),
  ];
};

/* ------------------------------ matrix ----------------------------- */

const CELL_GLYPH: Record<string, string> = {
  "-": "—",
  "?": "—",
  false: "✗",
  maybe: "△",
  n: "✗",
  ng: "✗",
  no: "✗",
  o: "✓",
  ok: "✓",
  partial: "△",
  true: "✓",
  warn: "△",
  x: "✗",
  y: "✓",
  yes: "✓",
  "~": "△",
  "×": "✗",
  "–": "—",
  "—": "—",
  "△": "△",
  "○": "✓",
  "✅": "✓",
  "✓": "✓",
  "✔": "✓",
  "✕": "✗",
  "✗": "✗",
  "✘": "✗",
  "❌": "✗",
  "？": "—",
};

const matrixCell = (cell: string): string => {
  const key = cell.trim().toLowerCase();
  return key === "" ? "—" : (CELL_GLYPH[key] ?? cell.trim());
};

/** `- label | a | b` list items → matrix rows. */
const matrixRows = (node: MdxTarget): string[][] => {
  const rows: string[][] = [];
  const walk = (n: Node): void => {
    if (n.type === "listItem") {
      const text = isParent(n)
        ? n.children
            .map((c) => textOf(c))
            .join("")
            .trim()
        : "";
      if (text !== "") {
        rows.push(text.split("|").map((c) => c.trim()));
      }
      return;
    }
    if (isParent(n)) {
      for (const c of n.children) {
        walk(c);
      }
    }
  };
  for (const c of node.children ?? []) {
    walk(c);
  }
  return rows;
};

/* ------------------------------- board ------------------------------ */

const boardCard = (node: MdxTarget, ctx: AsciiCtx): ListItem =>
  statusItem(
    attr(node, "status"),
    [strong([txt(attr(node, "title") ?? "")]), ...suffix(chipParts(node))],
    ctx.children(node).filter((c) => c.type !== "paragraph" || textOf(c) !== "")
  );

/* ----------------------------- registry ---------------------------- */

export const planningRenderers: AsciiRegistry = {
  Approval: {
    flow: (n, ctx) => [
      para([
        txt(`${statusIcon(approvalStatus(attr(n, "status")))} `),
        strong([txt(attr(n, "name") ?? "")]),
        ...suffix([attr(n, "role"), attr(n, "status"), attr(n, "date")]),
        ...(ctx.inline(n).length === 0 ? [] : [txt(": "), ...ctx.inline(n)]),
      ]),
    ],
  },
  Approvals: {
    flow: (n, ctx) => [
      list(
        els(n, "Approval").map((a) =>
          statusItem(
            approvalStatus(attr(a, "status")),
            [
              strong([txt(attr(a, "name") ?? "")]),
              ...suffix([attr(a, "role"), attr(a, "status"), attr(a, "date")]),
            ],
            []
          )
        )
      ),
      ...ctx.children(withoutEls(n, ["Approval"])),
    ],
  },
  Board: {
    flow: (n, ctx) => [
      ...caption(attr(n, "title")),
      ...els(n, "Lane").flatMap((lane): RootContent[] => {
        const cards = els(lane, "BoardCard");
        return [
          para([
            txt(`${statusIcon(attr(lane, "status"))} `),
            strong([txt(`${attr(lane, "title") ?? ""} (${cards.length})`)]),
          ]),
          list(cards.map((c) => boardCard(c, ctx))),
        ];
      }),
      ...ctx.children(withoutEls(n, ["Lane"])),
    ],
  },
  BoardCard: {
    flow: (n, ctx) => [
      para([
        txt(`${statusIcon(attr(n, "status"))} `),
        strong([txt(attr(n, "title") ?? "")]),
        ...suffix(chipParts(n)),
        ...(ctx.inline(n).length === 0 ? [] : [txt(": "), ...ctx.inline(n)]),
      ]),
    ],
  },
  Decision: {
    flow: (n, ctx) => [
      para([
        strong([txt(`Decision — ${attr(n, "title") ?? ""}`)]),
        ...suffix([attr(n, "status"), attr(n, "date")]),
      ]),
      ...ctx.children(n),
    ],
  },
  Due: {
    text: (n) => [
      icode(`due: ${attr(n, "date") ?? ""}`),
      ...(nonEmpty(attr(n, "label")) ? [txt(` ${attr(n, "label")}`)] : []),
    ],
  },
  Effort: {
    text: (n, ctx) => [
      icode((attr(n, "size") ?? "").toUpperCase()),
      ...(ctx.inline(n).length === 0 ? [] : [txt(" "), ...ctx.inline(n)]),
    ],
  },
  Event: {
    flow: (n, ctx) => [
      para([
        txt(`${statusIcon(attr(n, "status"))} `),
        strong([txt(attr(n, "date") ?? "")]),
        ...(nonEmpty(attr(n, "title")) ? [txt(` — ${attr(n, "title")}`)] : []),
        ...(ctx.inline(n).length === 0 ? [] : [txt(": "), ...ctx.inline(n)]),
      ]),
    ],
  },
  Gantt: { flow: gantt },
  Lane: { flow: (n, ctx) => ctx.children(n) },
  Matrix: {
    flow: (n) => {
      const headers = (attr(n, "cols") ?? "")
        .split(",")
        .map((c) => c.trim())
        .filter(nonEmpty);
      const rows = matrixRows(n).map((r) => [
        r[0] ?? "",
        ...r.slice(1).map(matrixCell),
      ]);
      return [...caption(attr(n, "title")), table(["", ...headers], rows)];
    },
  },
  Milestone: {
    flow: (n) => [
      para([
        txt("◆ "),
        icode(attr(n, "name") ?? ""),
        ...suffix([attr(n, "date"), attr(n, "status"), attr(n, "note")]),
      ]),
    ],
  },
  Option: {
    flow: (n, ctx) => [
      para([
        strong([txt(attr(n, "title") ?? "")]),
        ...suffix([attr(n, "status")]),
      ]),
      ...ctx.children(n),
    ],
  },
  Owner: {
    text: (n) => [
      icode(`@${(attr(n, "name") ?? "").replace(/^@+/u, "")}`),
      ...(nonEmpty(attr(n, "role")) ? [txt(` (${attr(n, "role")})`)] : []),
    ],
  },
  Phase: {
    flow: (n, ctx) => {
      const status = attr(n, "status");
      const meta = joined(chipParts(n));
      return [
        heading(2, [
          txt(attr(n, "title") ?? ""),
          ...(nonEmpty(status) ? [txt(" "), icode(status)] : []),
        ]),
        ...(meta === "" ? [] : [para([txt(meta)])]),
        ...ctx.children(n),
      ];
    },
  },
  Priority: { text: (n) => [icode((attr(n, "level") ?? "").toUpperCase())] },
  Req: {
    flow: (n, ctx) => [
      para([
        icode(attr(n, "id") ?? ""),
        ...(ctx.inline(n).length === 0 ? [] : [txt(" "), ...ctx.inline(n)]),
      ]),
    ],
  },
  Reqs: {
    flow: (n, ctx) => [
      list(
        els(n, "Req").map((r) =>
          statusItem(
            attr(r, "status"),
            [
              icode(attr(r, "id") ?? ""),
              ...(ctx.inline(r).length === 0
                ? []
                : [txt(" "), ...ctx.inline(r)]),
            ],
            []
          )
        )
      ),
      ...ctx.children(withoutEls(n, ["Req"])),
    ],
  },
  Risk: {
    flow: (n, ctx) => [
      para([
        strong([
          icode((attr(n, "level") ?? "medium").toUpperCase()),
          txt(` ${attr(n, "title") ?? ""}`),
        ]),
      ]),
      ...ctx.children(n),
      ...(nonEmpty(attr(n, "mitigation"))
        ? [para([em([txt("Mitigation:")]), txt(` ${attr(n, "mitigation")}`)])]
        : []),
    ],
  },
  Stat: {
    flow: (n) => [
      para([
        strong([txt(attr(n, "value") ?? "")]),
        txt(` ${attr(n, "label") ?? ""}`),
        ...(nonEmpty(attr(n, "delta")) ? [txt(` (${attr(n, "delta")})`)] : []),
      ]),
    ],
    text: (n) => [
      strong([txt(attr(n, "value") ?? "")]),
      txt(` ${attr(n, "label") ?? ""}`),
    ],
  },
  Stats: {
    flow: (n) => [
      list(
        els(n, "Stat").map((s) =>
          item([
            para([
              strong([txt(attr(s, "value") ?? "")]),
              txt(` ${attr(s, "label") ?? ""}`),
              ...(nonEmpty(attr(s, "delta"))
                ? [txt(` (${attr(s, "delta")})`)]
                : []),
            ]),
          ])
        )
      ),
    ],
  },
  StatusBadge: {
    text: (n) => [icode(attr(n, "status") ?? "")],
  },
  Step: {
    flow: (n, ctx) => [
      para([
        txt(`${statusIcon(attr(n, "status"))} `),
        ...ctx.inline(n),
        ...suffix(chipParts(n)),
      ]),
    ],
  },
  Steps: {
    flow: (n, ctx) => {
      const steps = els(n, "Step");
      const done = steps.filter(
        (s) => (attr(s, "status") ?? "").toLowerCase() === "done"
      ).length;
      return [
        ...(flag(n, "progress") && steps.length > 0
          ? [
              para([
                strong([txt("Progress")]),
                txt(" "),
                icode(
                  `[${bar(done / steps.length, 10)}] ${done}/${steps.length}`
                ),
              ]),
            ]
          : []),
        list(
          steps.map((s) =>
            statusItem(
              attr(s, "status"),
              [...ctx.inline(s), ...suffix(chipParts(s))],
              []
            )
          )
        ),
        ...ctx.children(withoutEls(n, ["Step"])),
      ];
    },
  },
  Summary: {
    flow: (n) => {
      const d = Math.max(0, num(n, "done") ?? 0);
      const t = Math.max(0, num(n, "total") ?? 0);
      return [
        para([
          strong([txt(attr(n, "label") ?? "Progress")]),
          txt(" "),
          icode(`[${bar(t > 0 ? d / t : 0, 10)}] ${d}/${t}`),
        ]),
      ];
    },
    text: (n) => {
      const d = Math.max(0, num(n, "done") ?? 0);
      const t = Math.max(0, num(n, "total") ?? 0);
      return [icode(`[${bar(t > 0 ? d / t : 0, 10)}] ${d}/${t}`)];
    },
  },
  Task: {
    flow: (n) => [
      para([
        icode(attr(n, "name") ?? ""),
        ...suffix([
          [attr(n, "start"), attr(n, "end")].filter(nonEmpty).join(" → "),
          attr(n, "status"),
          ownerChip(n),
          attr(n, "note"),
        ]),
      ]),
    ],
  },
  Timeline: {
    flow: (n, ctx) => [
      ...caption(attr(n, "title")),
      list(
        els(n, "Event").map((e) =>
          statusItem(
            attr(e, "status"),
            [
              strong([txt(attr(e, "date") ?? "")]),
              ...(nonEmpty(attr(e, "title"))
                ? [txt(` — ${attr(e, "title")}`)]
                : []),
              ...(ctx.inline(e).length === 0
                ? []
                : [txt(": "), ...ctx.inline(e)]),
            ],
            []
          )
        )
      ),
      ...ctx.children(withoutEls(n, ["Event"])),
    ],
  },
};

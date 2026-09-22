/** ASCII renderers for planning & status components. */

import { differenceInCalendarDays, isValid, parseISO } from "date-fns";
import type { ListItem, PhrasingContent, RootContent } from "mdast";
import type { Node } from "unist";

import { nonEmpty, own } from "../guards.js";
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
  const date = parseISO(iso);
  return isValid(date)
    ? differenceInCalendarDays(date, new Date(1970, 0, 1))
    : undefined;
};

const TASK_CHAR: Record<string, string> = {
  blocked: "▒",
  doing: "▓",
  done: "█",
  todo: "░",
};

interface GanttTask {
  el: MdxTarget;
  end: number;
  name: string;
  progress?: number;
  start: number;
  status: string;
}

interface GanttMilestone {
  date: number;
  el: MdxTarget;
  name: string;
}

interface GanttRange {
  first: number;
  last: number;
}

const GANTT_WIDTH = 40;

const ganttTasks = (node: MdxTarget): GanttTask[] =>
  els(node, "Task").flatMap((el) => {
    const start = dayOf(attr(el, "start"));
    if (start === undefined) {
      return [];
    }
    return [
      {
        el,
        end: Math.max(start, dayOf(attr(el, "end")) ?? start),
        name: attr(el, "name") ?? "",
        progress: num(el, "progress"),
        start,
        status: (attr(el, "status") ?? "todo").toLowerCase(),
      },
    ];
  });

const ganttMilestones = (node: MdxTarget): GanttMilestone[] =>
  els(node, "Milestone").flatMap((el) => {
    const date = dayOf(attr(el, "date"));
    return date === undefined
      ? []
      : [{ date, el, name: attr(el, "name") ?? "" }];
  });

const ganttRange = (
  node: MdxTarget,
  tasks: GanttTask[],
  milestones: GanttMilestone[]
): GanttRange => {
  const start = dayOf(attr(node, "start"));
  const end = dayOf(attr(node, "end"));
  let first =
    start ??
    Math.min(
      ...tasks.map((task) => task.start),
      ...milestones.map((milestone) => milestone.date)
    );
  let last =
    end ??
    Math.max(
      ...tasks.map((task) => task.end),
      ...milestones.map((milestone) => milestone.date)
    );
  if (last < first) {
    if (end !== undefined && start === undefined) {
      first = last;
    } else {
      last = first;
    }
  }
  return { first, last };
};

const ganttColumn = (day: number, range: GanttRange): number =>
  Math.max(
    0,
    Math.min(
      GANTT_WIDTH,
      Math.round(
        ((day - range.first) / (range.last - range.first + 1)) * GANTT_WIDTH
      )
    )
  );

const ganttTaskLine = (
  task: GanttTask,
  range: GanttRange,
  nameWidth: number
): string => {
  const from = ganttColumn(task.start, range);
  const to = Math.max(from + 1, ganttColumn(task.end + 1, range));
  const outside = task.end < range.first || task.start > range.last;
  const glyph = own(TASK_CHAR, task.status) ?? "░";
  const filled =
    ((to - from) * Math.min(100, Math.max(0, task.progress ?? 0))) / 100;
  const cells = Array.from({ length: GANTT_WIDTH }, (_, i) => {
    if (outside || i < from || i >= to) {
      return " ";
    }
    return i - from < filled ? "█" : glyph;
  }).join("");
  const tail = joined([ownerChip(task.el), attr(task.el, "note")]);
  return `${pad(task.name, nameWidth)} ${cells}${tail === "" ? "" : `  ${tail}`}`;
};

const ganttMilestoneLine = (
  milestone: GanttMilestone,
  range: GanttRange,
  nameWidth: number
): string => {
  const position =
    milestone.date < range.first || milestone.date > range.last
      ? -1
      : Math.min(GANTT_WIDTH - 1, ganttColumn(milestone.date, range));
  const cells = Array.from({ length: GANTT_WIDTH }, (_, i) =>
    i === position ? "◆" : " "
  ).join("");
  const tail = joined([
    attr(milestone.el, "status"),
    attr(milestone.el, "note"),
  ]);
  return `${pad(milestone.name, nameWidth)} ${cells}${tail === "" ? "" : `  ${tail}`}`;
};

const gantt = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const tasks = ganttTasks(node);
  const milestones = ganttMilestones(node);
  if (tasks.length === 0 && milestones.length === 0) {
    return ctx.children(node);
  }
  const range = ganttRange(node, tasks, milestones);
  const nameWidth = Math.min(
    24,
    Math.max(
      8,
      ...tasks.map((task) => task.name.length),
      ...milestones.map((milestone) => milestone.name.length)
    )
  );
  const iso = (day: number): string =>
    new Date(day * DAY_MS).toISOString().slice(0, 10);
  const title = attr(node, "title");
  const lines = [
    ...(nonEmpty(title) ? [title] : []),
    `${pad("", nameWidth)} ${iso(range.first)} → ${iso(range.last)}`,
    ...tasks.map((task) => ganttTaskLine(task, range, nameWidth)),
    ...milestones.map((milestone) =>
      ganttMilestoneLine(milestone, range, nameWidth)
    ),
  ];
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
  return key === "" ? "—" : (own(CELL_GLYPH, key) ?? cell.trim());
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
            ctx.children(a)
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
          ...ctx.children(withoutEls(lane, ["BoardCard"])),
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
    flow: (n, ctx) => [
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
      ...ctx.children(withoutEls(n, ["Stat"])),
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

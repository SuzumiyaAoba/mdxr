/** ASCII renderers for chart components — block-art bars and text tables. */

import type { PhrasingContent, RootContent } from "mdast";

import { nonEmpty } from "../guards.js";
import {
  attr,
  csv,
  els,
  flag,
  icode,
  item,
  list,
  num,
  para,
  pre,
  strong,
  table,
  txt,
  withoutEls,
} from "./ast.js";
import type { AsciiCtx, AsciiRegistry, MdxTarget } from "./ast.js";
import { bar, pad, spark } from "./glyphs.js";
import { caption, suffix } from "./parts.js";

/** Attribute → number list (`values="12, 8, 4"`). */
const nums = (node: MdxTarget, key: string): number[] =>
  csv(node, key)
    .map(Number)
    .filter((v) => !Number.isNaN(v));

/** `label ██████░░ 42` fence rows from name/value pairs. */
const barRows = (
  rows: { name: string; note?: string; value: number; valueText: string }[],
  max: number
): string[] => {
  const W = 24;
  const nameW = Math.min(20, Math.max(4, ...rows.map((r) => r.name.length)));
  const valW = Math.max(1, ...rows.map((r) => r.valueText.length));
  return rows.map(
    (r) =>
      `${pad(r.name, nameW)} ${bar(max === 0 ? 0 : r.value / max, W)} ${pad(r.valueText, valW)}${nonEmpty(r.note) ? `  ${r.note}` : ""}`
  );
};

/* ------------------------------ bar chart --------------------------- */

const barChart = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const unit = attr(node, "unit") ?? "";
  const bars = els(node, "Bar").map((b) => {
    const values = nums(b, "values");
    const single = num(b, "value");
    const total =
      values.length > 0 ? values.reduce((a, v) => a + v, 0) : (single ?? 0);
    return {
      name: attr(b, "name") ?? "",
      note: attr(b, "note"),
      value: total,
      valueText:
        values.length > 0
          ? `${total}${unit} (${values.join("+")})`
          : `${attr(b, "value") ?? total}${unit}`,
    };
  });
  if (bars.length === 0) {
    return ctx.children(node);
  }
  const max = num(node, "max") ?? Math.max(...bars.map((b) => b.value));
  const title = attr(node, "title");
  const lines = [...(nonEmpty(title) ? [title] : []), ...barRows(bars, max)];
  return [pre(lines.join("\n")), ...ctx.children(withoutEls(node, ["Bar"]))];
};

/* ----------------------------- line chart --------------------------- */

const lineChart = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const unit = attr(node, "unit") ?? "";
  const series = els(node, "Series").flatMap((s) => {
    const values = nums(s, "values");
    return values.length === 0
      ? []
      : [
          {
            dash: flag(s, "dash"),
            name: attr(s, "name") ?? "",
            values,
          },
        ];
  });
  if (series.length === 0) {
    return ctx.children(node);
  }
  const labels = csv(node, "labels");
  const nameW = Math.min(20, Math.max(4, ...series.map((s) => s.name.length)));
  const lines: string[] = [];
  const title = attr(node, "title");
  if (nonEmpty(title)) {
    lines.push(`${title}${nonEmpty(unit) ? ` (${unit})` : ""}`);
  }
  for (const s of series) {
    const min = Math.min(...s.values);
    const maxV = Math.max(...s.values);
    lines.push(
      `${pad(s.name, nameW)} ${spark(s.values)}  ${min}–${maxV}${unit}${s.dash ? "  (dashed)" : ""}`
    );
  }
  if (labels.length > 0) {
    lines.push(`${pad("", nameW)} ${labels.join("  ")}`);
  }
  return [pre(lines.join("\n")), ...ctx.children(withoutEls(node, ["Series"]))];
};

/* ----------------------------- pie chart ---------------------------- */

const namedValues = (node: MdxTarget, kind: string, unit: string) =>
  els(node, kind).map((s) => ({
    name: attr(s, "name") ?? "",
    note: attr(s, "note"),
    value: num(s, "value") ?? 0,
    valueText: `${attr(s, "value") ?? "0"}${unit}`,
  }));

const shareChart = (
  node: MdxTarget,
  ctx: AsciiCtx,
  kind: string
): RootContent[] => {
  const unit = attr(node, "unit") ?? "";
  const rows = namedValues(node, kind, unit);
  if (rows.length === 0) {
    return ctx.children(node);
  }
  const total = rows.reduce((a, r) => a + r.value, 0);
  const withPct = rows.map((r) => ({
    ...r,
    valueText: `${r.valueText} (${total === 0 ? 0 : Math.round((r.value / total) * 100)}%)`,
  }));
  const title = attr(node, "title");
  const lines = [
    ...(nonEmpty(title) ? [title] : []),
    ...barRows(withPct, Math.max(...rows.map((r) => r.value))),
  ];
  return [pre(lines.join("\n")), ...ctx.children(withoutEls(node, [kind]))];
};

/* ------------------------------ scatter ------------------------------ */

const scatter = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const points = els(node, "Point");
  if (points.length === 0) {
    return ctx.children(node);
  }
  const x = attr(node, "x") ?? "x";
  const y = attr(node, "y") ?? "y";
  return [
    ...caption(attr(node, "title"), ` (${x} × ${y})`),
    table(
      [x, y, "name", "size"],
      points.map((p) => [
        attr(p, "x") ?? "",
        attr(p, "y") ?? "",
        attr(p, "name") ?? "",
        attr(p, "size") ?? "",
      ])
    ),
    ...ctx.children(withoutEls(node, ["Point"])),
  ];
};

/* ------------------------------- radar ------------------------------- */

const radar = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const series = els(node, "Series").flatMap((s) => {
    const values = nums(s, "values");
    return values.length === 0 ? [] : [{ name: attr(s, "name") ?? "", values }];
  });
  const axes = csv(node, "axes");
  if (series.length === 0 || axes.length === 0) {
    return ctx.children(node);
  }
  const max = num(node, "max") ?? Math.max(...series.flatMap((s) => s.values));
  const unit = attr(node, "unit") ?? "";
  const W = 12;
  const nameW = Math.min(16, Math.max(4, ...axes.map((a) => a.length)));
  const lines: string[] = [];
  const title = attr(node, "title");
  if (nonEmpty(title)) {
    lines.push(title);
  }
  lines.push(
    `${pad("", nameW)} ${series.map((s) => pad(s.name, W + 2)).join("")}`
  );
  for (const [i, axis] of axes.entries()) {
    const cells = series
      .map((s) => {
        const v = s.values[i] ?? 0;
        return `${bar(max === 0 ? 0 : v / max, W)} ${pad(`${v}${unit}`, 2)}`;
      })
      .join(" ");
    lines.push(`${pad(axis, nameW)} ${cells}`);
  }
  return [pre(lines.join("\n")), ...ctx.children(withoutEls(node, ["Series"]))];
};

/* ------------------------------- funnel ------------------------------ */

const funnel = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const unit = attr(node, "unit") ?? "";
  const stages = els(node, "Stage").map((s) => ({
    name: attr(s, "name") ?? "",
    note: attr(s, "note"),
    value: num(s, "value") ?? 0,
    valueText: `${attr(s, "value") ?? "0"}${unit}`,
  }));
  if (stages.length === 0) {
    return ctx.children(node);
  }
  const first = stages[0]?.value ?? 0;
  const withPct = stages.map((s) => ({
    ...s,
    valueText: `${s.valueText} (${first === 0 ? 0 : Math.round((s.value / first) * 100)}%)`,
  }));
  const title = attr(node, "title");
  const lines = [
    ...(nonEmpty(title) ? [title] : []),
    ...barRows(withPct, first),
  ];
  return [pre(lines.join("\n")), ...ctx.children(withoutEls(node, ["Stage"]))];
};

/* ------------------------------ quadrant ------------------------------ */

const quadrant = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const pins = els(node, "Pin");
  if (pins.length === 0) {
    return ctx.children(node);
  }
  const x = attr(node, "x") ?? "x";
  const y = attr(node, "y") ?? "y";
  const zones = csv(node, "quadrants");
  return [
    ...caption(
      attr(node, "title"),
      ` (${x} × ${y}${zones.length === 4 ? ` — ${zones.join(" / ")}` : ""})`
    ),
    list(
      pins.map((p) =>
        item([
          para([
            strong([txt(attr(p, "name") ?? "")]),
            txt(` (${attr(p, "x") ?? "?"}, ${attr(p, "y") ?? "?"})`),
            ...suffix([attr(p, "note")]),
          ]),
        ])
      )
    ),
    ...ctx.children(withoutEls(node, ["Pin"])),
  ];
};

/* ------------------------------- bridge ------------------------------ */

const bridge = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const unit = attr(node, "unit") ?? "";
  const deltas = els(node, "Delta");
  if (deltas.length === 0) {
    return ctx.children(node);
  }
  const W = 24;
  const nameW = Math.min(
    20,
    Math.max(4, ...deltas.map((d) => (attr(d, "name") ?? "").length))
  );
  let run = 0;
  let maxV = 0;
  const rows = deltas.map((d) => {
    const v = num(d, "value") ?? 0;
    const isTotal = flag(d, "total");
    const from = isTotal ? 0 : run;
    run = isTotal ? v : run + v;
    maxV = Math.max(maxV, Math.abs(run), Math.abs(from));
    return {
      delta: `${v > 0 && !isTotal ? "+" : ""}${attr(d, "value") ?? v}`,
      from,
      name: attr(d, "name") ?? "",
      note: attr(d, "note"),
      to: run,
      total: isTotal,
    };
  });
  const lines: string[] = [];
  const title = attr(node, "title");
  if (nonEmpty(title)) {
    lines.push(`${title}${nonEmpty(unit) ? ` (${unit})` : ""}`);
  }
  const spanCells = (lo: number, hi: number, fill: string): string =>
    Array.from({ length: W }, (_, i) => {
      const x0 = (i / W) * maxV;
      const x1 = ((i + 1) / W) * maxV;
      return x1 > lo && x0 < hi ? fill : " ";
    }).join("");
  for (const r of rows) {
    const cells = spanCells(
      Math.min(r.from, r.to),
      Math.max(r.from, r.to),
      r.total ? "█" : "▓"
    );
    lines.push(
      `${pad(r.name, nameW)} ${cells} ${r.delta}${unit} → ${r.to}${unit}${nonEmpty(r.note) ? `  ${r.note}` : ""}`
    );
  }
  return [pre(lines.join("\n")), ...ctx.children(withoutEls(node, ["Delta"]))];
};

/* ------------------------------- sankey ------------------------------ */

const sankey = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const unit = attr(node, "unit") ?? "";
  const links = els(node, "Link");
  if (links.length === 0) {
    return ctx.children(node);
  }
  const stages = csv(node, "stages");
  const items = links.map((l) =>
    item([
      para([
        icode(attr(l, "from") ?? ""),
        txt(" → "),
        icode(attr(l, "to") ?? ""),
        txt(` ${attr(l, "value") ?? ""}${unit}`),
        ...suffix([attr(l, "label")]),
      ]),
    ])
  );
  return [
    ...caption(
      attr(node, "title"),
      stages.length > 0 ? ` (${stages.join(" → ")})` : ""
    ),
    list(items),
    ...ctx.children(withoutEls(node, ["Link"])),
  ];
};

/* -------------------------------- venn ------------------------------- */

const venn = (node: MdxTarget, ctx: AsciiCtx): RootContent[] => {
  const unit = attr(node, "unit") ?? "";
  const sets = els(node, "Set").map((s) =>
    item([
      para([
        txt("◯ "),
        strong([txt(attr(s, "name") ?? "")]),
        txt(` ${attr(s, "value") ?? ""}${unit}`),
        ...suffix([attr(s, "note")]),
      ]),
    ])
  );
  const overlaps = els(node, "Overlap").map((o) =>
    item([
      para([
        txt("∩ "),
        txt(csv(o, "sets").join(" ∩ ")),
        txt(` ${attr(o, "value") ?? ""}${unit}`),
      ]),
    ])
  );
  if (sets.length === 0 && overlaps.length === 0) {
    return ctx.children(node);
  }
  return [
    ...caption(attr(node, "title")),
    list([...sets, ...overlaps]),
    ...ctx.children(withoutEls(node, ["Set", "Overlap"])),
  ];
};

/* ----------------------------- registry ----------------------------- */

const deltaSign = (v: number): string => (v > 0 ? "+" : "");

const nameValue = (node: MdxTarget, label = "name"): PhrasingContent[] => [
  strong([txt(attr(node, label) ?? "")]),
  txt(` ${attr(node, "value") ?? ""}`),
  ...suffix([attr(node, "note")]),
];

export const chartRenderers: AsciiRegistry = {
  Bar: {
    flow: (n) => [para(nameValue(n))],
    text: (n) => nameValue(n),
  },
  BarChart: { flow: barChart },
  Bridge: { flow: bridge },
  Delta: {
    flow: (n) => [
      para([
        strong([txt(attr(n, "name") ?? "")]),
        txt(
          ` ${flag(n, "total") ? "=" : deltaSign(num(n, "value") ?? 0)}${attr(n, "value") ?? ""}`
        ),
        ...suffix([attr(n, "note")]),
      ]),
    ],
  },
  DiffStat: {
    text: (n) => [
      txt(`+${attr(n, "adds") ?? "0"}`),
      txt(` −${attr(n, "dels") ?? "0"}`),
      ...(nonEmpty(attr(n, "files"))
        ? [txt(` (${attr(n, "files")} files)`)]
        : []),
    ],
  },
  Funnel: { flow: funnel },
  LineChart: { flow: lineChart },
  Link: {
    flow: (n) => [
      para([
        icode(attr(n, "from") ?? ""),
        txt(" → "),
        icode(attr(n, "to") ?? ""),
        ...suffix([attr(n, "value"), attr(n, "label")]),
      ]),
    ],
    text: (n) => [
      icode(attr(n, "from") ?? ""),
      txt(" → "),
      icode(attr(n, "to") ?? ""),
    ],
  },
  Overlap: {
    flow: (n) => [
      para([
        txt("∩ "),
        txt(csv(n, "sets").join(" ∩ ")),
        txt(` ${attr(n, "value") ?? ""}`),
      ]),
    ],
  },
  PieChart: { flow: (n, ctx) => shareChart(n, ctx, "Slice") },
  Pin: {
    flow: (n) => [
      para([
        strong([txt(attr(n, "name") ?? "")]),
        txt(` (${attr(n, "x") ?? "?"}, ${attr(n, "y") ?? "?"})`),
        ...suffix([attr(n, "note")]),
      ]),
    ],
  },
  Point: {
    flow: (n) => [
      para([
        txt(`(${attr(n, "x") ?? "?"}, ${attr(n, "y") ?? "?"})`),
        ...suffix([attr(n, "name"), attr(n, "size")]),
      ]),
    ],
    text: (n) => [txt(`(${attr(n, "x") ?? "?"}, ${attr(n, "y") ?? "?"})`)],
  },
  Quadrant: { flow: quadrant },
  Radar: { flow: radar },
  Sankey: { flow: sankey },
  Scatter: { flow: scatter },
  Score: {
    flow: (n) => {
      const value = num(n, "value") ?? 0;
      const max = num(n, "max") ?? 100;
      return [
        para([
          icode(`[${bar(max === 0 ? 0 : value / max, 10)}]`),
          txt(" "),
          strong([txt(`${attr(n, "value") ?? ""}/${attr(n, "max") ?? "100"}`)]),
          ...suffix([attr(n, "label"), attr(n, "detail")]),
        ]),
      ];
    },
    text: (n) => {
      const value = num(n, "value") ?? 0;
      const max = num(n, "max") ?? 100;
      return [
        icode(`[${bar(max === 0 ? 0 : value / max, 10)}]`),
        txt(" "),
        strong([txt(`${attr(n, "value") ?? ""}/${attr(n, "max") ?? "100"}`)]),
        ...suffix([attr(n, "label"), attr(n, "detail")]),
      ];
    },
  },
  Series: {
    flow: (n) => [
      para([
        icode(attr(n, "name") ?? ""),
        ...(nums(n, "values").length === 0
          ? []
          : [txt(` ${spark(nums(n, "values"))}`)]),
      ]),
    ],
    text: (n) => [
      icode(attr(n, "name") ?? ""),
      txt(` ${spark(nums(n, "values"))}`),
    ],
  },
  Set: {
    flow: (n) => [para([txt("◯ "), ...nameValue(n)])],
    text: (n) => [txt(attr(n, "name") ?? "")],
  },
  Slice: {
    flow: (n) => [para(nameValue(n))],
    text: (n) => nameValue(n),
  },
  Spark: {
    text: (n) => [
      ...(nonEmpty(attr(n, "label")) ? [txt(`${attr(n, "label")} `)] : []),
      txt(spark(nums(n, "values"))),
    ],
  },
  Stage: {
    flow: (n) => [para(nameValue(n))],
    text: (n) => nameValue(n),
  },
  Tile: {
    flow: (n) => [para(nameValue(n))],
    text: (n) => nameValue(n),
  },
  Treemap: { flow: (n, ctx) => shareChart(n, ctx, "Tile") },
  Venn: { flow: venn },
};

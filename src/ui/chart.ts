import { numOf } from "./attrs.js";
import { TONE, TONE_TEXT } from "./tones.js";
import type { Tone } from "./tones.js";

/**
 * Shared chart machinery — series palette, document-attribute number parsing,
 * "nice" axis scales, and pure SVG/layout geometry for the catalog's
 * quantitative components (BarChart, LineChart, PieChart, Scatter, Radar,
 * Funnel, Quadrant, Bridge, Treemap, Sankey, Venn). All layouts are computed
 * at render time; no client JS is involved.
 */

/** Tones usable as an explicit `tone=` override on data items. */
export const CHART_TONES = [
  "sky",
  "emerald",
  "amber",
  "violet",
  "teal",
  "indigo",
  "orange",
  "red",
] as const satisfies readonly Tone[];

export type ChartTone = (typeof CHART_TONES)[number];

/** `fill-{c}-500` — solid SVG fill per tone (literal classes for the scanner). */
const FILL: Record<Tone, string> = {
  amber: "fill-amber-500",
  emerald: "fill-emerald-500",
  indigo: "fill-indigo-500",
  neutral: "fill-neutral-400",
  orange: "fill-orange-500",
  red: "fill-red-500",
  sky: "fill-sky-500",
  teal: "fill-teal-500",
  violet: "fill-violet-500",
};

/** `fill-{c}-500/20` — soft SVG fill for areas, ribbons, venn circles. */
const SOFT_FILL: Record<Tone, string> = {
  amber: "fill-amber-500/20",
  emerald: "fill-emerald-500/20",
  indigo: "fill-indigo-500/20",
  neutral: "fill-neutral-400/20",
  orange: "fill-orange-500/20",
  red: "fill-red-500/20",
  sky: "fill-sky-500/20",
  teal: "fill-teal-500/20",
  violet: "fill-violet-500/20",
};

/** `stroke-{c}-500` — SVG stroke per tone. */
const STROKE: Record<Tone, string> = {
  amber: "stroke-amber-500",
  emerald: "stroke-emerald-500",
  indigo: "stroke-indigo-500",
  neutral: "stroke-neutral-400",
  orange: "stroke-orange-500",
  red: "stroke-red-500",
  sky: "stroke-sky-500",
  teal: "stroke-teal-500",
  violet: "stroke-violet-500",
};

/** `bg-{c}-500` — solid HTML fill for bars/dots. */
const BG: Record<Tone, string> = {
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  indigo: "bg-indigo-500",
  neutral: "bg-neutral-400",
  orange: "bg-orange-500",
  red: "bg-red-500",
  sky: "bg-sky-500",
  teal: "bg-teal-500",
  violet: "bg-violet-500",
};

/** `bg-{c}-500/25` — translucent HTML fill for floating range segments. */
const SOFT_BG: Record<Tone, string> = {
  amber: "bg-amber-500/25",
  emerald: "bg-emerald-500/25",
  indigo: "bg-indigo-500/25",
  neutral: "bg-neutral-400/25",
  orange: "bg-orange-500/25",
  red: "bg-red-500/25",
  sky: "bg-sky-500/25",
  teal: "bg-teal-500/25",
  violet: "bg-violet-500/25",
};

export interface SeriesStyle {
  /** Solid HTML background (`bg-{c}-500`) — bars, dots. */
  bg: string;
  /** Solid SVG fill (`fill-{c}-500`). */
  fill: string;
  /** Translucent SVG fill (`fill-{c}-500/20`) — areas, ribbons. */
  soft: string;
  /** Translucent HTML background — range segments. */
  softBg: string;
  /** SVG stroke (`stroke-{c}-500`). */
  stroke: string;
  /** Text accent (`text-{c}-600 dark:text-{c}-400`). */
  text: string;
  /** Toned tile surface (soft bg + readable text) — treemap regions. */
  tile: string;
}

const styleOf = (tone: Tone): SeriesStyle => ({
  bg: BG[tone],
  fill: FILL[tone],
  soft: SOFT_FILL[tone],
  softBg: SOFT_BG[tone],
  stroke: STROKE[tone],
  text: TONE_TEXT[tone],
  tile: TONE[tone],
});

/** Cyclic series palette — index `i` mod length picks a series color. */
export const SERIES: readonly SeriesStyle[] = CHART_TONES.map(styleOf);

export const seriesOf = (i: number): SeriesStyle =>
  SERIES[((i % SERIES.length) + SERIES.length) % SERIES.length];

/** Style for an explicit `tone` prop; falls back to the cyclic palette. */
export const toneOf = (tone: string | undefined, i: number): SeriesStyle => {
  const t = CHART_TONES.find((c) => c === tone);
  return t === undefined ? seriesOf(i) : styleOf(t);
};

/**
 * Comma/space-separated number list from a document attribute
 * (`values="12, 8, 4"`). Non-numeric entries are dropped.
 */
export const numList = (x: unknown): number[] => {
  if (typeof x === "number") {
    return Number.isFinite(x) ? [x] : [];
  }
  if (typeof x !== "string") {
    return [];
  }
  return x
    .split(/[,\s]+/u)
    .map(numOf)
    .filter((n): n is number => n !== undefined);
};

/**
 * Comma-separated label list (`labels="Q1, Q2"`). Whitespace around each
 * label is trimmed; empty entries are dropped.
 */
export const textList = (x: unknown): string[] =>
  typeof x === "string"
    ? x
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s !== "")
    : [];

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Compact tick/label number — `1.2k`, `3M`, plain integers under 1000. */
export const fmtNum = (n: number): string => {
  if (!Number.isFinite(n)) {
    return "0";
  }
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `${round2(n / 1_000_000)}M`;
  }
  if (abs >= 10_000) {
    return `${Math.round(n / 1000)}k`;
  }
  if (abs >= 1000) {
    return `${round2(n / 1000)}k`;
  }
  if (abs > 0 && abs < 0.01) {
    return String(Number(n.toPrecision(3)));
  }
  return `${round2(n)}`;
};

const STEPS = [1, 2, 2.5, 5, 10] as const;
const MAX_TICK_INTERVALS = 100;

const tickCount = (count: number): number =>
  Number.isFinite(count) && count > 0
    ? Math.min(MAX_TICK_INTERVALS, Math.max(1, Math.floor(count)))
    : 4;

/** Round a span up to a 1/2/2.5/5×10^k step. */
const niceStep = (rough: number): number => {
  if (rough <= Number.MIN_VALUE) {
    return Number.MIN_VALUE;
  }
  if (!Number.isFinite(rough)) {
    return Number.MAX_VALUE;
  }
  const mag = 10 ** Math.floor(Math.log10(rough));
  if (mag === 0) {
    return rough;
  }
  const normalized = rough / mag;
  const multiplier = STEPS.find((s) => s >= normalized - 1e-9) ?? 10;
  return Math.min(Number.MAX_VALUE, multiplier * mag);
};

/** Integer indices bound the work; repeatedly adding tiny floats may never advance. */
const axisTicks = (first: number, last: number, step: number): number[] => {
  const length = Math.min(
    MAX_TICK_INTERVALS + 3,
    Math.max(0, last - first + 1)
  );
  const decimals = Math.max(0, 1 - Math.floor(Math.log10(step)));
  const ticks = Array.from({ length }, (_, i) => {
    const value = (first + i) * step;
    // Round relative to the step, preserving fractional ticks and removing
    // arithmetic noise. toFixed only supports up to 100 decimal places.
    const rounded = Number(
      decimals <= 100 ? value.toFixed(decimals) : value.toPrecision(15)
    );
    return rounded === 0 ? 0 : rounded;
  });
  return [...new Set(ticks.filter(Number.isFinite))];
};

export interface AxisScale {
  /** Scale top — `max` rounded up to a tick multiple. */
  ceil: number;
  /** Tick step (a "nice" 1/2/2.5/5×10^k value). */
  step: number;
  /** Tick values including `ceil` (0 excluded — the baseline marks it). */
  ticks: number[];
}

/**
 * Zero-based "nice" scale covering [0, max]: the top is a round multiple of
 * a 1/2/2.5/5 step and interior ticks land on step boundaries.
 */
export const niceScale = (max: number, count = 4): AxisScale => {
  if (!Number.isFinite(max) || !(max > 0)) {
    return { ceil: 1, step: 1, ticks: [1] };
  }
  const step = niceStep(max / tickCount(count));
  const last = Math.ceil(max / step - 1e-9);
  const ceil = Math.min(Number.MAX_VALUE, last * step);
  const ticks = axisTicks(1, last, step);
  return { ceil, step, ticks };
};

export interface ExtentScale {
  max: number;
  min: number;
  /** Tick values snapped to step boundaries within [min, max]. */
  ticks: number[];
}

/**
 * "Nice" scale covering an arbitrary [min, max] extent — bounds snap outward
 * to step boundaries so ticks stay round. A zero-width extent expands ±1.
 */
export const niceBounds = (lo: number, hi: number, count = 4): ExtentScale => {
  let min = lo;
  let max = hi;
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(min <= max)) {
    min = 0;
    max = 1;
  }
  if (min === max) {
    const padding = Math.max(1, Math.abs(min) * Number.EPSILON * 4);
    min = Math.max(-Number.MAX_VALUE, min - padding);
    max = Math.min(Number.MAX_VALUE, max + padding);
  }
  const intervals = tickCount(count);
  const step = niceStep(max / intervals - min / intervals);
  const first = Math.floor(min / step + 1e-9);
  const last = Math.ceil(max / step - 1e-9);
  const lo2 = Math.max(-Number.MAX_VALUE, first * step);
  const hi2 = Math.min(Number.MAX_VALUE, last * step);
  const ticks = axisTicks(first, last, step);
  return { max: hi2, min: lo2, ticks };
};

/** Point on a circle — angle in radians measured from +x, y grows downward. */
export const polar = (
  cx: number,
  cy: number,
  r: number,
  angle: number
): { x: number; y: number } => ({
  x: cx + r * Math.cos(angle),
  y: cy + r * Math.sin(angle),
});

const TWO_PI = Math.PI * 2;

/**
 * SVG path for a pie (r0 = 0) or annular sector between angles a0→a1
 * (radians, +x = 0, clockwise as y grows). A full turn is split into two
 * half arcs — a single `A` command cannot close on itself.
 */
export const sectorPath = (
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number
): string => {
  const span = Math.min(a1 - a0, TWO_PI);
  if (span <= 0 || r1 <= 0) {
    return "";
  }
  const segs = span >= TWO_PI - 1e-6 ? 2 : 1;
  const each = span / segs;
  const parts: string[] = [];
  for (let i = 0; i < segs; i += 1) {
    const s = a0 + each * i;
    const e = s + each;
    const p0 = polar(cx, cy, r1, s);
    const p1 = polar(cx, cy, r1, e);
    const large = each > Math.PI ? 1 : 0;
    if (r0 <= 0) {
      parts.push(
        `M${cx} ${cy}L${p0.x} ${p0.y}A${r1} ${r1} 0 ${large} 1 ${p1.x} ${p1.y}Z`
      );
    } else {
      const q0 = polar(cx, cy, r0, e);
      const q1 = polar(cx, cy, r0, s);
      parts.push(
        `M${p0.x} ${p0.y}A${r1} ${r1} 0 ${large} 1 ${p1.x} ${p1.y}L${q0.x} ${q0.y}A${r0} ${r0} 0 ${large} 0 ${q1.x} ${q1.y}Z`
      );
    }
  }
  return parts.join("");
};

/** Rounded coordinate for emitted SVG — trims float noise in `d` strings. */
const c = (n: number): number => Math.round(n * 100) / 100;

/** `M x0 y0 L x1 y1 …` polyline path from scaled points. */
export const linePath = (pts: readonly { x: number; y: number }[]): string =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"}${c(p.x)} ${c(p.y)}`).join("");

/** Closed polygon from `linePath` extended to a baseline (area fills). */
export const areaPath = (
  pts: readonly { x: number; y: number }[],
  baseY: number
): string => {
  if (pts.length === 0) {
    return "";
  }
  const [first] = pts;
  const last = pts.at(-1);
  return `${linePath(pts)}L${c(last?.x ?? 0)} ${c(baseY)}L${c(first?.x ?? 0)} ${c(baseY)}Z`;
};

export interface Rect {
  h: number;
  w: number;
  x: number;
  y: number;
}

/**
 * Worst aspect ratio in a candidate row — `w` is the length of the side the
 * row is laid along (Bruls et al. §4). Squarify closes a row when adding
 * another item would raise this ratio.
 */
const worst = (row: readonly number[], w: number): number => {
  const s = row.reduce((a, b) => a + b, 0);
  if (s <= 0 || w <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  const s2 = s * s;
  const w2 = w * w;
  let m = 0;
  for (const r of row) {
    m = Math.max(m, (w2 * r) / s2, s2 / (w2 * r));
  }
  return m;
};

const positiveMaximum = (values: readonly number[]): number => {
  let max = 0;
  for (const value of values) {
    if (Number.isFinite(value)) {
      max = Math.max(max, value);
    }
  }
  return max;
};

/**
 * Squarified treemap layout (Bruls et al.) — returns one rect per input
 * value in the same order, packed inside `rect`. Non-positive values are
 * dropped (they get a zero rect).
 */
export const squarify = (values: readonly number[], rect: Rect): Rect[] => {
  const maxValue = positiveMaximum(values);
  const pending = values
    .map((v, i) => ({ i, v }))
    .filter((e) => Number.isFinite(e.v) && e.v > 0)
    .map(({ i, v }) => ({ i, v: v / maxValue }))
    .toSorted((a, b) => b.v - a.v);
  const placed = new Map<number, Rect>();
  let rest = { ...rect };
  let remaining = pending.reduce((a, e) => a + e.v, 0);
  let row: { i: number; v: number }[] = [];

  const closeRow = () => {
    if (row.length === 0 || remaining <= 0) {
      return;
    }
    const sum = row.reduce((a, e) => a + e.v, 0);
    const frac = Math.min(1, sum / remaining);
    // The row strip occupies `frac` of the remaining area along the short
    // side: a vertical strip when wider than tall, horizontal otherwise.
    const wide = rest.w >= rest.h;
    const strip = wide
      ? { h: rest.h, w: rest.w * frac, x: rest.x, y: rest.y }
      : { h: rest.h * frac, w: rest.w, x: rest.x, y: rest.y };
    let offset = 0;
    for (const e of row) {
      const share = sum === 0 ? 0 : e.v / sum;
      placed.set(
        e.i,
        wide
          ? { h: strip.h * share, w: strip.w, x: strip.x, y: strip.y + offset }
          : { h: strip.h, w: strip.w * share, x: strip.x + offset, y: strip.y }
      );
      offset += wide ? strip.h * share : strip.w * share;
    }
    rest = wide
      ? {
          h: rest.h,
          w: rest.w * (1 - frac),
          x: rest.x + strip.w,
          y: rest.y,
        }
      : {
          h: rest.h * (1 - frac),
          w: rest.w,
          x: rest.x,
          y: rest.y + strip.h,
        };
    remaining -= sum;
    row = [];
  };

  for (const item of pending) {
    const side = Math.min(rest.w, rest.h);
    // Aspect ratios compare areas, not raw values; changing the data's unit
    // must not change the tiling.
    const area = rest.w * rest.h;
    const total = remaining;
    const areaOf = (e: { v: number }): number => (e.v / total) * area;
    const withItem = [...row, item];
    if (
      row.length > 0 &&
      worst(withItem.map(areaOf), side) > worst(row.map(areaOf), side)
    ) {
      closeRow();
      row = [item];
    } else {
      row = withItem;
    }
  }
  closeRow();
  return values.map((_, i) => placed.get(i) ?? { h: 0, w: 0, x: 0, y: 0 });
};

export interface SankeySpec {
  links: { from: string; to: string; value: number }[];
  nodes: { id: string; stage?: number }[];
}

export interface SankeyLayout {
  /** Pixels per unit — ribbon thickness is `value * k`. */
  k: number;
  /** Link endpoints in layout space (y offsets within source/target bars). */
  links: { from: string; sy: number; to: string; ty: number; value: number }[];
  nodes: { h: number; id: string; stage: number; value: number; y: number }[];
  stages: number;
}

/** Every node id mentioned by a <Node> spec or a link endpoint. */
const sankeyIds = (spec: SankeySpec): Set<string> => {
  const ids = new Set<string>();
  for (const n of spec.nodes) {
    ids.add(n.id);
  }
  for (const l of spec.links) {
    ids.add(l.from);
    ids.add(l.to);
  }
  return ids;
};

/** Longest-path layering: stage = 1 + max stage of any incoming node. */
const resolveStage = (
  id: string,
  trail: Set<string>,
  incoming: Map<string, string[]>,
  explicit: Map<string, number | undefined>,
  stageOf: Map<string, number>
): number => {
  const fixed = explicit.get(id);
  if (fixed !== undefined) {
    return fixed;
  }
  const memo = stageOf.get(id);
  if (memo !== undefined) {
    return memo;
  }
  if (trail.has(id)) {
    // Cycle — break at the first repeated node.
    return 0;
  }
  trail.add(id);
  const deps = incoming.get(id) ?? [];
  const stage =
    deps.length === 0
      ? 0
      : Math.max(
          ...deps.map((d) =>
            resolveStage(d, trail, incoming, explicit, stageOf)
          )
        ) + 1;
  trail.delete(id);
  stageOf.set(id, stage);
  return stage;
};

/** Node value = max(in-flow, out-flow). */
const sankeyValues = (links: SankeySpec["links"]): ((id: string) => number) => {
  const flow = new Map<string, { in: number; out: number }>();
  const add = (id: string, key: "in" | "out", v: number): void => {
    const f = flow.get(id) ?? { in: 0, out: 0 };
    f[key] += v;
    flow.set(id, f);
  };
  for (const l of links) {
    add(l.from, "out", l.value);
    add(l.to, "in", l.value);
  }
  return (id) => {
    const f = flow.get(id);
    return f === undefined ? 0 : Math.max(f.in, f.out);
  };
};

const explicitSankeyStages = (
  nodes: SankeySpec["nodes"]
): Map<string, number | undefined> => {
  const stages = new Map<string, number | undefined>();
  for (const node of nodes) {
    if (
      node.stage !== undefined &&
      (!Number.isSafeInteger(node.stage) || node.stage < 0)
    ) {
      throw new Error(
        `Invalid Sankey stage for node "${node.id}": expected a non-negative integer`
      );
    }
    stages.set(node.id, node.stage);
  }
  return stages;
};

/**
 * Sankey layout: nodes are vertical bars stacked per stage column, one
 * px-per-unit scale across the whole diagram (column totals equalize at the
 * tallest column). Stage comes from `node.stage` or longest-path layering
 * from the source nodes. Link `sy`/`ty` are offsets inside each bar where
 * the ribbon attaches.
 */
export const layoutSankey = (
  spec: SankeySpec,
  height: number,
  gap: number
): SankeyLayout => {
  const explicit = explicitSankeyStages(spec.nodes);
  const stageOf = new Map<string, number>();
  const incoming = new Map<string, string[]>();
  for (const l of spec.links) {
    const deps = incoming.get(l.to) ?? [];
    deps.push(l.from);
    incoming.set(l.to, deps);
  }
  const nodes = [...sankeyIds(spec)].map((id) => ({
    id,
    stage: resolveStage(id, new Set(), incoming, explicit, stageOf),
  }));
  const stages = Math.max(0, ...nodes.map((n) => n.stage)) + 1;
  const valueOf = sankeyValues(spec.links);

  // Stage numbers can be sparse; allocating every intervening column would
  // make a large explicit stage consume memory proportional to its index.
  const byStage = new Map<number, string[]>();
  for (const n of nodes) {
    const column = byStage.get(n.stage) ?? [];
    column.push(n.id);
    byStage.set(n.stage, column);
  }
  const columns = [...byStage.values()];
  const maxRows = Math.max(1, ...columns.map((col) => col.length));
  const maxTotal = Math.max(
    0,
    ...columns.map((col) => col.reduce((a, id) => a + valueOf(id), 0))
  );
  const available = Math.max(0, height);
  const spacing = Math.min(Math.max(0, gap), available / (2 * maxRows));
  const minHeight = Math.min(2, available / (2 * maxRows));
  const k =
    maxTotal <= 0
      ? 0
      : Math.max(0, available - spacing * (maxRows - 1) - minHeight * maxRows) /
        maxTotal;

  const laid = new Map<string, { h: number; y: number }>();
  for (const col of columns) {
    let y = 0;
    for (const id of col) {
      const h = Math.max(minHeight, valueOf(id) * k);
      laid.set(id, { h, y });
      y += h + spacing;
    }
  }

  // Ribbon attach offsets: links leave a source bar top-down in link order,
  // and arrive at target bars the same way — matching orders keep the
  // crossing count low without a full barycenter pass.
  const sourceUsed = new Map<string, number>();
  const targetUsed = new Map<string, number>();
  const links = spec.links.map((l) => {
    const sOff = sourceUsed.get(l.from) ?? 0;
    const tOff = targetUsed.get(l.to) ?? 0;
    sourceUsed.set(l.from, sOff + l.value * k);
    targetUsed.set(l.to, tOff + l.value * k);
    return { from: l.from, sy: sOff, to: l.to, ty: tOff, value: l.value };
  });

  return {
    k,
    links,
    nodes: nodes.map((n) => ({
      h: laid.get(n.id)?.h ?? 0,
      id: n.id,
      stage: n.stage,
      value: valueOf(n.id),
      y: laid.get(n.id)?.y ?? 0,
    })),
    stages,
  };
};

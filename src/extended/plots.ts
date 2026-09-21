import type { DataRecord } from "./data.js";
import {
  dateValue,
  display,
  mean,
  numberValue,
  numbers,
  percentage,
  positive,
  quantile,
  rounded,
  uniqueIds,
  words,
} from "./data.js";

export interface PlotMark {
  file?: string;
  href?: string;
  kind: "rect" | "circle" | "line" | "path" | "text";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  x2?: number;
  y2?: number;
  r?: number;
  d?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  label?: string;
  opacity?: number;
  anchor?: "start" | "middle" | "end";
}
export interface PlotModel {
  metrics?: DataRecord[];
  marks: PlotMark[];
  rows: DataRecord[];
  width: number;
  height: number;
  summary: string;
}
export const PLOT_COLORS = [
  "#0284c7",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#0d9488",
  "#dc2626",
  "#4f46e5",
];
const color = (i: number): string =>
  PLOT_COLORS[i % PLOT_COLORS.length] ?? "#0284c7";
const LEFT = 110;
const RIGHT = 690;
const TOP = 30;
const BOTTOM = 300;
const text = (
  x: number,
  y: number,
  value: string,
  anchor: PlotMark["anchor"] = "middle"
): PlotMark => ({ anchor, kind: "text", text: value, x, y });
const line = (
  x: number,
  y: number,
  x2: number,
  y2: number,
  stroke = "#a3a3a3"
): PlotMark => ({ kind: "line", stroke, x, x2, y, y2 });
const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  label: string
): PlotMark => ({
  fill,
  height: Math.max(0, height),
  kind: "rect",
  label,
  width: Math.max(0, width),
  x,
  y,
});
const circle = (
  x: number,
  y: number,
  fill: string,
  label: string,
  r = 4
): PlotMark => ({ fill, kind: "circle", label, r, x, y });
const scale =
  (min: number, max: number, start: number, end: number) =>
  (value: number): number =>
    start + ((value - min) / (max - min || 1)) * (end - start);
const bounds = (
  values: number[],
  options: DataRecord,
  zero = false
): [number, number] => {
  let min = numberValue(
    options.min,
    "min",
    Math.min(...values, ...(zero ? [0] : []))
  );
  let max = numberValue(
    options.max,
    "max",
    Math.max(...values, ...(zero ? [0] : []))
  );
  if (min > max) {
    throw new Error("Plot: min must not exceed max");
  }
  if (min === max) {
    min -= 0.5;
    max += 0.5;
  }
  return [min, max];
};
const axis = (min: number, max: number, horizontal = true): PlotMark[] => {
  const marks: PlotMark[] = [
    line(LEFT, BOTTOM, RIGHT, BOTTOM),
    line(LEFT, TOP, LEFT, BOTTOM),
  ];
  for (let i = 0; i <= 4; i += 1) {
    const value = min + ((max - min) * i) / 4;
    if (horizontal) {
      marks.push(
        text(
          LEFT + ((RIGHT - LEFT) * i) / 4,
          BOTTOM + 22,
          String(rounded(value))
        )
      );
    } else {
      marks.push(
        text(
          LEFT - 10,
          BOTTOM - ((BOTTOM - TOP) * i) / 4,
          String(rounded(value)),
          "end"
        )
      );
    }
  }
  return marks;
};
const model = (
  marks: PlotMark[],
  rows: DataRecord[],
  summary = "",
  height = 350,
  width = 720
): PlotModel => ({ height, marks, rows, summary, width });
const samplesOf = (rows: DataRecord[]): number[] =>
  rows.flatMap((row) =>
    row.values === undefined ? [numberValue(row.value)] : numbers(row.values)
  );
const seriesOf = (rows: DataRecord[]): { name: string; values: number[] }[] =>
  rows.map((row, index) => {
    const values = numbers(row.values);
    if (!values.length) {
      throw new Error("Distribution series must contain observations");
    }
    return { name: display(row.name) || String(index + 1), values };
  });

const heatmap = (rows: DataRecord[], options: DataRecord): PlotModel => {
  const xs = [...new Set(rows.map((row) => display(row.x)))];
  const ys = [...new Set(rows.map((row) => display(row.y)))];
  const values = rows.map((row) => numberValue(row.value));
  const [min, max] = bounds(values, options);
  const cw = Math.min(90, 540 / Math.max(1, xs.length));
  const ch = Math.min(42, 480 / Math.max(1, ys.length));
  const marks: PlotMark[] = xs.map((x, i) =>
    text(LEFT + (i + 0.5) * cw, 22, x)
  );
  marks.push(
    ...ys.map((y, i) => text(LEFT - 8, 40 + (i + 0.5) * ch, y, "end"))
  );
  for (const row of rows) {
    const x = LEFT + xs.indexOf(display(row.x)) * cw;
    const y = 30 + ys.indexOf(display(row.y)) * ch;
    const value = numberValue(row.value);
    const intensity = Math.max(0, Math.min(1, (value - min) / (max - min)));
    marks.push(
      rect(
        x,
        y,
        cw - 2,
        ch - 2,
        `hsl(204 85% ${92 - intensity * 52}%)`,
        `${display(row.y)} / ${display(row.x)}: ${value}`
      )
    );
    if (cw > 28 && ch > 20) {
      marks.push({
        ...text(
          x + cw / 2,
          y + ch / 2 + 4,
          display(row.valueLabel ?? rounded(value))
        ),
        fill: intensity > 0.6 ? "#fff" : "#172554",
      });
    }
  }
  return model(
    marks,
    rows,
    `${rounded(min)} → ${rounded(max)}`,
    65 + ch * ys.length
  );
};

const histogram = (rows: DataRecord[], options: DataRecord): PlotModel => {
  const values = samplesOf(rows);
  if (!values.length) {
    return model([], [], "No observations");
  }
  const [min, max] = bounds(values, options);
  const count = numberValue(
    options.bins,
    "bins",
    Math.ceil(Math.sqrt(values.length))
  );
  if (!Number.isInteger(count) || count < 1 || count > 200) {
    throw new Error("Histogram: bins must be an integer from 1 to 200");
  }
  const counts = Array.from({ length: count }, () => 0);
  let outside = 0;
  for (const value of values) {
    if (value < min || value > max) {
      outside += 1;
      continue;
    }
    const index = Math.min(
      count - 1,
      Math.floor(((value - min) / (max - min)) * count)
    );
    counts[index] = (counts[index] ?? 0) + 1;
  }
  const ymax = Math.max(1, ...counts);
  const marks = axis(min, max);
  const width = (RIGHT - LEFT) / count;
  const bins = counts.map((n, i) => ({
    count: n,
    from: rounded(min + (i * (max - min)) / count),
    to: rounded(min + ((i + 1) * (max - min)) / count),
  }));
  for (const [i, bin] of bins.entries()) {
    marks.push(
      rect(
        LEFT + i * width,
        BOTTOM - (bin.count / ymax) * (BOTTOM - TOP),
        width - 1,
        (bin.count / ymax) * (BOTTOM - TOP),
        color(0),
        `${bin.from}–${bin.to}: ${bin.count}`
      )
    );
  }
  return model(
    marks,
    bins,
    `${values.length} observations · ${outside} outside range`
  );
};

const boxPlot = (rows: DataRecord[], options: DataRecord): PlotModel => {
  const series = seriesOf(rows);
  const [min, max] = bounds(
    series.flatMap((s) => s.values),
    options
  );
  const x = scale(min, max, LEFT, RIGHT);
  const marks = axis(min, max);
  const summaries = series.map(({ name, values }, i) => {
    const q1 = quantile(values, 0.25);
    const median = quantile(values, 0.5);
    const q3 = quantile(values, 0.75);
    const spread = q3 - q1;
    const inside = values.filter(
      (n) => n >= q1 - 1.5 * spread && n <= q3 + 1.5 * spread
    );
    const low = Math.min(...inside);
    const high = Math.max(...inside);
    const y = TOP + ((i + 0.5) * (BOTTOM - TOP)) / series.length;
    marks.push(
      text(LEFT - 8, y + 4, name, "end"),
      line(x(low), y, x(high), y),
      line(x(low), y - 8, x(low), y + 8),
      line(x(high), y - 8, x(high), y + 8),
      rect(x(q1), y - 12, x(q3) - x(q1), 24, color(i), `${name}: ${median}`),
      line(x(median), y - 12, x(median), y + 12, "#fff")
    );
    for (const outlier of values.filter((n) => n < low || n > high)) {
      marks.push(
        circle(x(outlier), y, color(i), `${name}: outlier ${outlier}`, 3)
      );
    }
    return {
      count: values.length,
      max: high,
      median,
      min: low,
      name,
      outliers: values.filter((n) => n < low || n > high),
      q1,
      q3,
    };
  });
  return model(marks, summaries);
};

const ecdf = (rows: DataRecord[], options: DataRecord): PlotModel => {
  const values = samplesOf(rows).toSorted((a, b) => a - b);
  const [min, max] = bounds(values, options);
  const x = scale(min, max, LEFT, RIGHT);
  const y = scale(0, 1, BOTTOM, TOP);
  const unique = [...new Set(values)];
  const points = unique.map((value) => ({
    cumulative: values.filter((n) => n <= value).length / values.length,
    value,
  }));
  let d = `M ${LEFT} ${BOTTOM}`;
  for (const point of points) {
    d += ` H ${x(point.value)} V ${y(point.cumulative)}`;
  }
  d += ` H ${RIGHT}`;
  return model(
    [
      ...axis(min, max),
      { d, fill: "none", kind: "path", stroke: color(0), strokeWidth: 2 },
      text(LEFT - 5, TOP, "100%", "end"),
    ],
    points,
    `${values.length} observations`
  );
};

const intervalPlot = (rows: DataRecord[], options: DataRecord): PlotModel => {
  const values = rows.flatMap((row) => [
    numberValue(row.low),
    numberValue(row.high),
  ]);
  const [min, max] = bounds(values, options);
  const x = scale(min, max, LEFT, RIGHT);
  const marks = axis(min, max);
  for (const [i, row] of rows.entries()) {
    const low = numberValue(row.low);
    const high = numberValue(row.high);
    const value = numberValue(row.value);
    if (low > value || value > high) {
      throw new Error("IntervalPlot: expected low ≤ value ≤ high");
    }
    const y = TOP + ((i + 0.5) * (BOTTOM - TOP)) / rows.length;
    marks.push(
      text(LEFT - 8, y + 4, display(row.name), "end"),
      { ...line(x(low), y, x(high), y, color(i)), strokeWidth: 3 },
      circle(
        x(value),
        y,
        color(i),
        `${display(row.name)}: ${value} [${low}, ${high}]`,
        6
      )
    );
  }
  return model(marks, rows);
};

const bullet = (rows: DataRecord[], options: DataRecord): PlotModel => {
  const maximum = numberValue(
    options.max,
    "max",
    Math.max(
      ...rows.flatMap((row) => [
        positive(row.value, "value"),
        positive(row.target, "target"),
        ...(row.ranges !== undefined && row.ranges !== null
          ? numbers(row.ranges)
          : []),
      ]),
      1
    )
  );
  const x = scale(0, maximum, LEFT, RIGHT);
  const marks = axis(0, maximum);
  for (const [i, row] of rows.entries()) {
    const y = TOP + ((i + 0.5) * (BOTTOM - TOP)) / rows.length;
    const ranges =
      row.ranges !== undefined && row.ranges !== null
        ? numbers(row.ranges).toSorted((a, b) => b - a)
        : [maximum];
    for (const [j, range] of ranges.entries()) {
      marks.push(
        rect(
          LEFT,
          y - 15,
          x(range) - LEFT,
          30,
          ["#e5e5e5", "#a3a3a3", "#737373"][j % 3] ?? "#e5e5e5",
          `range ${range}`
        )
      );
    }
    marks.push(
      text(LEFT - 8, y + 4, display(row.name), "end"),
      rect(
        LEFT,
        y - 5,
        x(positive(row.value, "value")) - LEFT,
        10,
        color(i),
        `actual ${display(row.value)}`
      ),
      {
        ...line(
          x(positive(row.target, "target")),
          y - 18,
          x(positive(row.target, "target")),
          y + 18,
          "#e11d48"
        ),
        strokeWidth: 3,
      }
    );
  }
  return model(marks, rows);
};

const calendar = (rows: DataRecord[], options: DataRecord): PlotModel => {
  const days = rows.map((row) => ({
    date: new Date(dateValue(row.date)).toISOString().slice(0, 10),
    value: numberValue(row.value),
  }));
  uniqueIds(days, "date");
  const first = Math.min(...days.map((row) => dateValue(row.date)));
  const start = first - new Date(first).getUTCDay() * 86_400_000;
  const end = Math.max(...days.map((row) => dateValue(row.date)));
  const weeks = Math.floor((end - start) / (7 * 86_400_000)) + 1;
  if (weeks > 106) {
    throw new Error("CalendarHeatmap: at most two years per chart");
  }
  const [min, max] = bounds(
    days.map((row) => row.value),
    options,
    true
  );
  const size = Math.min(24, 590 / weeks);
  const marks: PlotMark[] = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ].map((day, i) => text(LEFT - 8, 45 + i * 24, day, "end"));
  for (const day of days) {
    const time = dateValue(day.date);
    const week = Math.floor((time - start) / (7 * 86_400_000));
    const weekday = new Date(time).getUTCDay();
    marks.push(
      rect(
        LEFT + week * size,
        30 + weekday * 24,
        size - 2,
        22,
        `hsl(150 65% ${90 - ((day.value - min) / (max - min)) * 55}%)`,
        `${day.date}: ${day.value}`
      )
    );
  }
  marks.push(
    text(LEFT, 222, new Date(first).toISOString().slice(0, 10), "start"),
    text(
      LEFT + weeks * size,
      222,
      new Date(end).toISOString().slice(0, 10),
      "end"
    )
  );
  return model(marks, days, `${min} → ${max}`, 245);
};

const pareto = (rows: DataRecord[]): PlotModel => {
  const sorted = rows
    .map((row) => ({
      name: display(row.name),
      value: positive(row.value, "value"),
    }))
    .toSorted((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, row) => sum + row.value, 0);
  const max = Math.max(1, ...sorted.map((row) => row.value));
  const width = (RIGHT - LEFT) / sorted.length;
  const marks = axis(0, max, false);
  let cumulative = 0;
  const points: string[] = [];
  const data = sorted.map((row, i) => {
    cumulative += row.value;
    const x = LEFT + (i + 0.5) * width;
    marks.push(
      rect(
        x - width * 0.4,
        BOTTOM - (row.value / max) * (BOTTOM - TOP),
        width * 0.8,
        (row.value / max) * (BOTTOM - TOP),
        color(0),
        `${row.name}: ${row.value}`
      ),
      text(x, BOTTOM + 22, row.name)
    );
    points.push(
      `${x},${BOTTOM - (total ? cumulative / total : 0) * (BOTTOM - TOP)}`
    );
    return { ...row, cumulative: percentage(cumulative, total) };
  });
  marks.push(
    {
      d: `M ${points.join(" L ")}`,
      fill: "none",
      kind: "path",
      stroke: color(2),
      strokeWidth: 2,
    },
    text(RIGHT, TOP - 10, "100% cumulative", "end")
  );
  return model(marks, data, `Total ${total}`);
};

const density = (values: number[], x: number, bandwidth: number): number =>
  mean(
    values.map(
      (value) =>
        Math.exp(-0.5 * ((x - value) / bandwidth) ** 2) /
        (bandwidth * Math.sqrt(2 * Math.PI))
    )
  );
const distributions = (
  rows: DataRecord[],
  options: DataRecord,
  violin: boolean
): PlotModel => {
  const series = seriesOf(rows);
  const [min, max] = bounds(
    series.flatMap((entry) => entry.values),
    options
  );
  const x = scale(min, max, LEFT, RIGHT);
  const marks = axis(min, max);
  const height = (BOTTOM - TOP) / series.length;
  for (const [i, entry] of series.entries()) {
    const bandwidth = numberValue(
      options.bandwidth,
      "bandwidth",
      (max - min) / 15
    );
    if (bandwidth <= 0) {
      throw new Error("Density bandwidth must be positive");
    }
    const points = Array.from({ length: 65 }, (_, j) => {
      const value = min + ((max - min) * j) / 64;
      return { density: density(entry.values, value, bandwidth), value };
    });
    const peak = Math.max(...points.map((point) => point.density), 1e-12);
    const center = TOP + (i + 0.6) * height;
    const upper = points.map(
      (point) =>
        `${x(point.value)},${center - (point.density / peak) * height * 0.42}`
    );
    const lower = violin
      ? points
          .toReversed()
          .map(
            (point) =>
              `${x(point.value)},${center + (point.density / peak) * height * 0.42}`
          )
      : [`${RIGHT},${center}`, `${LEFT},${center}`];
    marks.push(
      {
        d: `M ${[...upper, ...lower].join(" L ")} Z`,
        fill: color(i),
        kind: "path",
        label: entry.name,
        opacity: 0.65,
      },
      text(LEFT - 8, center + 4, entry.name, "end")
    );
  }
  return model(
    marks,
    series.map((entry) => ({
      count: entry.values.length,
      median: quantile(entry.values, 0.5),
      name: entry.name,
      values: entry.values,
    })),
    "Gaussian kernel density estimate"
  );
};

const comparison = (
  rows: DataRecord[],
  options: DataRecord,
  kind: string
): PlotModel => {
  const paired = kind !== "DotPlot";
  const values = rows.flatMap((row) =>
    paired
      ? [numberValue(row.before), numberValue(row.after)]
      : [numberValue(row.value)]
  );
  const [min, max] = bounds(values, options, true);
  const marks = axis(min, max, kind !== "SlopeChart");
  const position = scale(min, max, LEFT, RIGHT);
  const vertical = scale(min, max, BOTTOM, TOP);
  for (const [i, row] of rows.entries()) {
    const name = display(row.name);
    if (kind === "SlopeChart") {
      const y1 = vertical(numberValue(row.before));
      const y2 = vertical(numberValue(row.after));
      marks.push(
        { ...line(LEFT + 80, y1, RIGHT - 80, y2, color(i)), strokeWidth: 2 },
        circle(LEFT + 80, y1, color(i), `${name}: ${display(row.before)}`),
        circle(RIGHT - 80, y2, color(i), `${name}: ${display(row.after)}`),
        text(LEFT + 70, y1, `${name} ${display(row.before)}`, "end"),
        text(RIGHT - 70, y2, `${name} ${display(row.after)}`, "start")
      );
    } else {
      const y = TOP + ((i + 0.5) * (BOTTOM - TOP)) / rows.length;
      marks.push(text(LEFT - 8, y + 4, name, "end"));
      if (paired) {
        marks.push(
          {
            ...line(
              position(numberValue(row.before)),
              y,
              position(numberValue(row.after)),
              y,
              color(i)
            ),
            strokeWidth: 3,
          },
          circle(
            position(numberValue(row.before)),
            y,
            "#a3a3a3",
            `before: ${display(row.before)}`,
            5
          )
        );
      }
      marks.push(
        circle(
          position(numberValue(paired ? row.after : row.value)),
          y,
          color(i),
          `${name}: ${display(paired ? row.after : row.value)}`,
          6
        )
      );
    }
  }
  return model(marks, rows);
};

const bump = (rows: DataRecord[], options: DataRecord): PlotModel => {
  const series = seriesOf(rows);
  const length = Math.max(...series.map((entry) => entry.values.length));
  if (
    series.some(
      (entry) =>
        entry.values.length !== length ||
        entry.values.some((rank) => !Number.isInteger(rank) || rank < 1)
    )
  ) {
    throw new Error(
      "BumpChart: each series needs the same number of positive integer ranks"
    );
  }
  const labels = words(options.labels);
  const maxRank = Math.max(...series.flatMap((entry) => entry.values), 2);
  const x = scale(0, Math.max(1, length - 1), LEFT, RIGHT - 60);
  const y = scale(1, maxRank, TOP, BOTTOM);
  const marks: PlotMark[] = Array.from({ length }, (_, i) =>
    text(x(i), BOTTOM + 22, labels[i] ?? String(i + 1))
  );
  for (const [i, entry] of series.entries()) {
    marks.push(
      {
        d: `M ${entry.values.map((rank, j) => `${x(j)},${y(rank)}`).join(" L ")}`,
        fill: "none",
        kind: "path",
        stroke: color(i),
        strokeWidth: 3,
      },
      text(RIGHT - 50, y(entry.values.at(-1) ?? 1), entry.name, "start")
    );
    for (const [j, rank] of entry.values.entries()) {
      marks.push(
        circle(x(j), y(rank), color(i), `${entry.name}: rank ${rank}`)
      );
    }
  }
  return model(marks, rows, "Rank 1 at top");
};

const polar = (radius: number, angle: number): [number, number] => [
  360 + radius * Math.cos(angle),
  190 + radius * Math.sin(angle),
];
const sector = (
  inner: number,
  outer: number,
  start: number,
  end: number
): string => {
  const a = polar(outer, start);
  const b = polar(outer, end);
  const c = polar(inner, end);
  const d = polar(inner, start);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${a.join(",")} A ${outer} ${outer} 0 ${large} 1 ${b.join(",")} L ${c.join(",")} A ${inner} ${inner} 0 ${large} 0 ${d.join(",")} Z`;
};

const sunburst = (rows: DataRecord[]): PlotModel => {
  const byId = uniqueIds(rows);
  const children = new Map<string, string[]>();
  for (const row of rows) {
    const parent = display(row.parent);
    if (parent && !byId.has(parent)) {
      throw new Error(`Sunburst: unknown parent ${parent}`);
    }
    const ids = children.get(parent) ?? [];
    ids.push(display(row.id));
    children.set(parent, ids);
  }
  const active = new Set<string>();
  const totals = new Map<string, number>();
  const depths = new Map<string, number>();
  const totalOf = (id: string, depth: number): number => {
    if (active.has(id)) {
      throw new Error("Sunburst: cyclic hierarchy");
    }
    active.add(id);
    depths.set(id, depth);
    const descendants = children.get(id) ?? [];
    const value = descendants.length
      ? descendants.reduce((sum, child) => sum + totalOf(child, depth + 1), 0)
      : positive(byId.get(id)?.value, "value", 0);
    active.delete(id);
    totals.set(id, value);
    return value;
  };
  const roots = children.get("") ?? [];
  for (const root of roots) {
    totalOf(root, 0);
  }
  if (totals.size !== rows.length) {
    throw new Error("Sunburst: cyclic hierarchy");
  }
  const total = roots.reduce((sum, id) => sum + (totals.get(id) ?? 0), 0);
  const maxDepth = Math.max(0, ...depths.values()) + 1;
  const marks: PlotMark[] = [];
  const draw = (
    ids: string[],
    start: number,
    span: number,
    subtotal: number
  ): void => {
    let cursor = start;
    for (const [i, id] of ids.entries()) {
      const value = totals.get(id) ?? 0;
      const angle = subtotal ? (span * value) / subtotal : 0;
      const depth = depths.get(id) ?? 0;
      const inner = 16 + (depth * 145) / maxDepth;
      const outer = 16 + ((depth + 1) * 145) / maxDepth;
      if (angle > 0) {
        marks.push({
          d: sector(
            inner,
            outer,
            cursor,
            cursor + Math.min(angle, Math.PI * 2 - 1e-6)
          ),
          fill: color(i + depth),
          kind: "path",
          label: `${id}: ${value}`,
          stroke: "#fff",
        });
      }
      const mid = polar((inner + outer) / 2, cursor + angle / 2);
      if (angle > 0.4) {
        marks.push({ ...text(mid[0], mid[1], id), fill: "#fff" });
      }
      draw(children.get(id) ?? [], cursor, angle, value);
      cursor += angle;
    }
  };
  draw(roots, -Math.PI / 2, Math.PI * 2, total);
  return model(
    marks,
    rows.map((row) => ({ ...row, total: totals.get(display(row.id)) })),
    `Total ${total}`,
    390
  );
};

const chord = (rows: DataRecord[]): PlotModel => {
  const names = [
    ...new Set(rows.flatMap((row) => [display(row.from), display(row.to)])),
  ];
  const totals = new Map(names.map((name) => [name, 0]));
  for (const row of rows) {
    for (const key of ["from", "to"]) {
      totals.set(
        display(row[key]),
        (totals.get(display(row[key])) ?? 0) + positive(row.value, "value")
      );
    }
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  const positions = new Map<string, number>();
  const cursors = new Map<string, number>();
  let cursor = -Math.PI / 2;
  const factor = total > 0 ? (2 * Math.PI - names.length * 0.04) / total : 0;
  const marks: PlotMark[] = [];
  for (const [i, name] of names.entries()) {
    const angle = (totals.get(name) ?? 0) * factor;
    positions.set(name, cursor + angle / 2);
    cursors.set(name, cursor);
    if (angle > 0) {
      marks.push({
        d: sector(145, 157, cursor, cursor + angle),
        fill: color(i),
        kind: "path",
        label: `${name}: ${totals.get(name)}`,
      });
    }
    const label = polar(177, cursor + angle / 2);
    marks.push(text(label[0], label[1], name));
    cursor += angle + 0.04;
  }
  for (const row of rows) {
    const from = display(row.from);
    const to = display(row.to);
    const width = positive(row.value, "value") * factor;
    const start = cursors.get(from) ?? 0;
    cursors.set(from, start + width);
    const end = cursors.get(to) ?? 0;
    cursors.set(to, end + width);
    const a = polar(145, start);
    const b = polar(145, start + width);
    const c = polar(145, end);
    const d = polar(145, end + width);
    const arc = width > Math.PI ? 1 : 0;
    marks.push({
      d: `M ${a.join(",")} A 145 145 0 ${arc} 1 ${b.join(",")} Q 360 190 ${c.join(",")} A 145 145 0 ${arc} 1 ${d.join(",")} Q 360 190 ${a.join(",")} Z`,
      fill: color(names.indexOf(from)),
      kind: "path",
      label: `${from} → ${to}: ${display(row.value)}`,
      opacity: 0.45,
    });
  }
  return model(marks, rows, "Ribbon width is proportional to flow", 400);
};

const upset = (rows: DataRecord[]): PlotModel => {
  const names = [...new Set(rows.flatMap((row) => words(row.sets)))];
  const sorted = rows.toSorted(
    (a, b) => numberValue(b.value) - numberValue(a.value)
  );
  const width = 550 / Math.max(1, rows.length);
  const max = Math.max(1, ...rows.map((row) => positive(row.value, "value")));
  const marks: PlotMark[] = [];
  for (const [i, row] of sorted.entries()) {
    const x = LEFT + (i + 0.5) * width;
    const height = (positive(row.value, "value") / max) * 150;
    marks.push(
      rect(
        x - width * 0.3,
        180 - height,
        width * 0.6,
        height,
        color(0),
        `${display(row.sets)}: ${display(row.value)}`
      ),
      text(x, 172 - height, display(row.value))
    );
    const included = new Set(words(row.sets));
    const selected = names.flatMap((name, index) =>
      included.has(name) ? [index] : []
    );
    if (selected.length > 1) {
      marks.push({
        ...line(
          x,
          205 + Math.min(...selected) * 25,
          x,
          205 + Math.max(...selected) * 25,
          color(0)
        ),
        strokeWidth: 3,
      });
    }
    for (const [j, name] of names.entries()) {
      marks.push(
        circle(
          x,
          205 + j * 25,
          included.has(name) ? color(0) : "#d4d4d4",
          name,
          5
        )
      );
    }
  }
  for (const [i, name] of names.entries()) {
    marks.push(text(LEFT - 8, 209 + i * 25, name, "end"));
  }
  return model(
    marks,
    sorted,
    "Exclusive set intersections",
    235 + names.length * 25
  );
};

export const PLOT_NAMES = [
  "Heatmap",
  "Histogram",
  "BoxPlot",
  "ECDF",
  "IntervalPlot",
  "BulletChart",
  "CalendarHeatmap",
  "ParetoChart",
  "CohortTable",
  "ConfusionMatrix",
  "ViolinPlot",
  "RidgelinePlot",
  "DotPlot",
  "SlopeChart",
  "BumpChart",
  "DumbbellChart",
  "Sunburst",
  "ChordDiagram",
  "UpSetPlot",
] as const;
export type PlotName = (typeof PLOT_NAMES)[number];

const cohortTable = (rows: DataRecord[], options: DataRecord): PlotModel =>
  heatmap(
    rows.map((row) => {
      const retained = positive(row.retained, "retained");
      const total = positive(row.total, "total");
      if (retained > total) {
        throw new Error("CohortTable: retained cannot exceed total");
      }
      return {
        retained,
        total,
        value: total ? (retained / total) * 100 : 0,
        valueLabel: percentage(retained, total),
        x: row.period,
        y: row.cohort,
      };
    }),
    { max: 100, min: 0, ...options }
  );

const confusionMatrix = (
  rows: DataRecord[],
  options: DataRecord
): PlotModel => {
  const classes = [
    ...new Set(
      rows.flatMap((row) => [display(row.actual), display(row.predicted)])
    ),
  ];
  const cells = new Map<string, number>();
  for (const row of rows) {
    const count = positive(row.count, "count");
    if (!Number.isInteger(count)) {
      throw new TypeError("ConfusionMatrix: count must be an integer");
    }
    const key = JSON.stringify([display(row.actual), display(row.predicted)]);
    cells.set(key, (cells.get(key) ?? 0) + count);
  }
  const converted = classes.flatMap((actual) =>
    classes.map((predicted) => ({
      value: cells.get(JSON.stringify([actual, predicted])) ?? 0,
      x: predicted,
      y: actual,
    }))
  );
  const total = converted.reduce((sum, row) => sum + row.value, 0);
  const correct = converted
    .filter((row) => row.x === row.y)
    .reduce((sum, row) => sum + row.value, 0);
  const metrics = classes.map((label) => {
    const tp = cells.get(JSON.stringify([label, label])) ?? 0;
    const predicted = converted
      .filter((row) => row.x === label)
      .reduce((sum, row) => sum + row.value, 0);
    const support = converted
      .filter((row) => row.y === label)
      .reduce((sum, row) => sum + row.value, 0);
    return {
      class: label,
      f1: percentage(2 * tp, predicted + support),
      precision: percentage(tp, predicted),
      recall: percentage(tp, support),
      support,
    };
  });
  return {
    ...heatmap(converted, options),
    metrics,
    summary: `Accuracy ${percentage(correct, total)} · ${total} samples`,
  };
};

const PLOT_BUILDERS: Record<
  PlotName,
  (rows: DataRecord[], options: DataRecord) => PlotModel
> = {
  BoxPlot: boxPlot,
  BulletChart: bullet,
  BumpChart: bump,
  CalendarHeatmap: calendar,
  ChordDiagram: chord,
  CohortTable: cohortTable,
  ConfusionMatrix: confusionMatrix,
  DotPlot: (rows, options) => comparison(rows, options, "DotPlot"),
  DumbbellChart: (rows, options) => comparison(rows, options, "DumbbellChart"),
  ECDF: ecdf,
  Heatmap: heatmap,
  Histogram: histogram,
  IntervalPlot: intervalPlot,
  ParetoChart: pareto,
  RidgelinePlot: (rows, options) => distributions(rows, options, false),
  SlopeChart: (rows, options) => comparison(rows, options, "SlopeChart"),
  Sunburst: sunburst,
  UpSetPlot: upset,
  ViolinPlot: (rows, options) => distributions(rows, options, true),
};

export const plotModel = (
  name: PlotName,
  rows: DataRecord[],
  options: DataRecord = {}
): PlotModel => {
  if (!rows.length) {
    return model([], [], "No data");
  }
  return PLOT_BUILDERS[name](rows, options);
};

import { useId } from "react";
import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { attrTrue, BOOLISH_PROP, NUMISH, numOf } from "./attrs.js";
import { ChartLegend, ChartPanel } from "./chart-bits.js";
import {
  areaPath,
  fmtNum,
  linePath,
  niceBounds,
  numList,
  textList,
  toneOf,
} from "./chart.js";
import { collectChildProps } from "./children.js";
import { SERIES_SCHEMA, Series } from "./series.js";
import type { SeriesSpec } from "./series.js";
import { TEXT, TEXT_MICRO } from "./tones.js";

/**
 * Line chart — one or more <Series> trend lines over evenly-spaced
 * categories (`labels`). The y domain snaps to round bounds (`min`/`max`
 * override); `area` adds a soft fill under each line.
 */

const VB_W = 640;
const VB_H = 280;
const PLOT = { bottom: 244, left: 44, right: 628, top: 12 };

/** Gridline stroke — the SVG counterpart of RAIL_BG_CLS. */
const GRID_STROKE = "stroke-neutral-200 dark:stroke-neutral-700";
const BASE_STROKE = "stroke-neutral-300 dark:stroke-neutral-600";
/** Tick/label text — the SVG counterpart of TEXT.faint. */
const TICK_TEXT = "fill-neutral-400 dark:fill-neutral-500";

interface SeriesData {
  dash: boolean;
  name: string;
  nums: number[];
  spec: SeriesSpec;
}

const collectSeries = (
  children: ReactNode
): { rest: ReactNode[]; series: SeriesData[] } => {
  const { items, rest } = collectChildProps(
    children,
    Series,
    SERIES_SCHEMA,
    "Series"
  );
  const series = items.map((spec) => ({
    dash: attrTrue(spec.dash),
    name: spec.name,
    nums: numList(spec.values),
    spec,
  }));
  return { rest, series };
};

/** One plotted series — optional area fill under the line plus point markers. */
const SeriesG = (props: {
  cats: string[];
  filled: boolean;
  s: SeriesData;
  si: number;
  unit: string | undefined;
  xOf: (i: number) => number;
  yOf: (v: number) => number;
}): ReactElement => {
  const { cats, filled, s, si, unit, xOf, yOf } = props;
  const style = toneOf(s.spec.tone, si);
  const pts = s.nums.map((val, i) => ({ x: xOf(i), y: yOf(val) }));
  return (
    <g>
      {filled && pts.length > 1 ? (
        <path className={style.soft} d={areaPath(pts, PLOT.bottom)} />
      ) : null}
      <path
        className={style.stroke}
        d={linePath(pts)}
        fill="none"
        strokeDasharray={s.dash ? "4 3" : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
      {pts.map((p, i) => (
        <circle className={style.fill} cx={p.x} cy={p.y} key={i} r={2.2}>
          <title>
            {`${s.name}${cats[i] === undefined ? "" : ` · ${cats[i]}`} · ${fmtNum(s.nums[i] ?? 0)}${unit ?? ""}`}
          </title>
        </circle>
      ))}
    </g>
  );
};

/** Gridlines, y tick labels, x category labels, and the baseline. */
const Axes = (props: {
  cats: string[];
  ticks: number[];
  xOf: (i: number) => number;
  yOf: (v: number) => number;
}): ReactElement => {
  const { cats, ticks, xOf, yOf } = props;
  const [firstTick] = ticks;
  return (
    <>
      {ticks.map((t) => (
        <g key={t}>
          <line
            className={GRID_STROKE}
            strokeDasharray={t === firstTick ? undefined : "2 3"}
            strokeWidth={1}
            x1={PLOT.left}
            x2={PLOT.right}
            y1={yOf(t)}
            y2={yOf(t)}
          />
          <text
            className={TICK_TEXT}
            fontSize={9}
            textAnchor="end"
            x={PLOT.left - 6}
            y={yOf(t) + 3}
          >
            {fmtNum(t)}
          </text>
        </g>
      ))}
      <line
        className={BASE_STROKE}
        strokeWidth={1}
        x1={PLOT.left}
        x2={PLOT.right}
        y1={PLOT.bottom}
        y2={PLOT.bottom}
      />
      {cats.map((label, i) => (
        <text
          className={TICK_TEXT}
          fontSize={9}
          key={label}
          textAnchor="middle"
          x={xOf(i)}
          y={PLOT.bottom + 16}
        >
          {label}
        </text>
      ))}
    </>
  );
};

export const LineChart = defineComponent(
  {
    description:
      '折れ線グラフコンテナ (推移)。<Series name values="1,2,3"> を並べる。labels="Mon,Tue" で x 軸ラベル、area で塗りつぶし、min/max/unit でスケールと単位',
    schema: v.looseObject({
      area: BOOLISH_PROP,
      labels: v.optional(v.string()),
      max: v.optional(NUMISH),
      min: v.optional(NUMISH),
      title: v.optional(v.string()),
      unit: v.optional(v.string()),
    }),
  },
  ({ title, labels, area, min, max, unit, children }) => {
    const clipId = useId().replaceAll(":", "");
    const { series, rest } = collectSeries(children);
    const cats = textList(labels);
    const n = Math.max(cats.length, ...series.map((s) => s.nums.length));
    const all = series.flatMap((s) => s.nums);
    const lo = numOf(min);
    const hi = numOf(max);
    const extent = niceBounds(
      lo ?? Math.min(0, ...all),
      hi ?? Math.max(1, ...all)
    );
    const yMin = lo ?? extent.min;
    const yMax = hi ?? extent.max;
    const span = yMax - yMin || 1;

    const xOf = (i: number): number =>
      n <= 1
        ? (PLOT.left + PLOT.right) / 2
        : PLOT.left + (i / (n - 1)) * (PLOT.right - PLOT.left);
    const yOf = (val: number): number =>
      PLOT.bottom - ((val - yMin) / span) * (PLOT.bottom - PLOT.top);

    const ticks = extent.ticks.filter((t) => t >= yMin && t <= yMax);
    const filled = attrTrue(area);

    return (
      <ChartPanel
        figure={
          nonEmpty(unit) ? `${fmtNum(yMin)}–${fmtNum(yMax)}${unit}` : undefined
        }
        icon="lucide:chart-line"
        title={title}
      >
        <div className="px-4 py-3">
          <svg className="h-auto w-full" viewBox={`0 0 ${VB_W} ${VB_H}`}>
            <title>{title ?? "line chart"}</title>
            <defs>
              <clipPath id={clipId}>
                <rect
                  height={PLOT.bottom - PLOT.top}
                  width={PLOT.right - PLOT.left}
                  x={PLOT.left}
                  y={PLOT.top}
                />
              </clipPath>
            </defs>
            <Axes cats={cats} ticks={ticks} xOf={xOf} yOf={yOf} />
            <g clipPath={`url(#${clipId})`}>
              {series.map((s, si) => (
                <SeriesG
                  cats={cats}
                  filled={filled}
                  key={s.name}
                  s={s}
                  si={si}
                  unit={unit}
                  xOf={xOf}
                  yOf={yOf}
                />
              ))}
            </g>
          </svg>
          {rest.length > 0 ? (
            <div className={`${TEXT_MICRO} ${TEXT.muted}`}>{rest}</div>
          ) : null}
        </div>
        <ChartLegend
          items={series.map((s, i) => ({
            name: s.name,
            style: toneOf(s.spec.tone, i),
          }))}
        />
      </ChartPanel>
    );
  }
);

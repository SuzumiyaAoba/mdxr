import type { ReactNode } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { NUMISH, numOf } from "./attrs.js";
import { ChartLegend, ChartPanel } from "./chart-bits.js";
import {
  fmtNum,
  linePath,
  niceScale,
  numList,
  polar,
  textList,
  toneOf,
} from "./chart.js";
import { collectChildProps } from "./children.js";
import { SERIES_SCHEMA, Series } from "./series.js";
import type { SeriesSpec } from "./series.js";
import { TEXT, TEXT_MICRO } from "./tones.js";

/**
 * Radar/spider chart — each <Series> becomes a polygon across `axes`
 * (3+ labels). Ring gridlines at quarter steps of `max` (default: the
 * largest value, snapped to a nice bound).
 */

const VB = 340;
const CX = VB / 2;
const CY = VB / 2 + 4;
const R = 118;

const GRID_STROKE = "stroke-neutral-200 dark:stroke-neutral-700";
const TICK_TEXT = "fill-neutral-400 dark:fill-neutral-500";
const AXIS_TEXT = "fill-neutral-500 dark:fill-neutral-400";

/** Label text-anchor — centered near the vertical, outward otherwise. */
const anchorAt = (x: number): "end" | "middle" | "start" => {
  if (Math.abs(x - CX) < 8) {
    return "middle";
  }
  return x > CX ? "start" : "end";
};

const collectSeries = (
  children: ReactNode
): { rest: ReactNode[]; series: { nums: number[]; spec: SeriesSpec }[] } => {
  const { items, rest } = collectChildProps(
    children,
    Series,
    SERIES_SCHEMA,
    "Series"
  );
  const series = items.map((spec) => ({ nums: numList(spec.values), spec }));
  return { rest, series };
};

export const Radar = defineComponent(
  {
    description:
      'レーダーチャートコンテナ (多変量比較)。<Series name values> を並べる。axes="Perf,DX,Tests" で軸ラベル (系列値と同数)、max/unit でスケールと単位',
    schema: v.looseObject({
      axes: v.optional(v.string()),
      max: v.optional(NUMISH),
      title: v.optional(v.string()),
      unit: v.optional(v.string()),
    }),
  },
  ({ title, axes, max, unit, children }) => {
    const { series, rest } = collectSeries(children);
    const labels = textList(axes);
    const n = Math.max(labels.length, ...series.map((s) => s.nums.length));
    const all = series.flatMap((s) => s.nums);
    const scale = niceScale(numOf(max) ?? Math.max(1, ...all));

    const angleOf = (i: number): number => -Math.PI / 2 + (i / n) * Math.PI * 2;
    const ringAt = (frac: number): string =>
      `${linePath(
        Array.from({ length: n }, (_, i) => polar(CX, CY, R * frac, angleOf(i)))
      )}Z`;

    return (
      <ChartPanel
        figure={nonEmpty(unit) ? `0–${fmtNum(scale.ceil)}${unit}` : undefined}
        icon="lucide:target"
        title={title}
      >
        <div className="px-4 py-3">
          {n < 3 ? (
            <p className={`text-sm ${TEXT.muted}`}>
              Radar needs at least 3 axes.
            </p>
          ) : (
            <svg
              className="mx-auto h-auto w-full max-w-sm"
              viewBox={`0 0 ${VB} ${VB}`}
            >
              <title>{title ?? "radar chart"}</title>
              {[0.25, 0.5, 0.75, 1].map((f) => (
                <path
                  className={GRID_STROKE}
                  d={ringAt(f)}
                  fill="none"
                  key={f}
                  strokeDasharray={f === 1 ? undefined : "2 3"}
                  strokeWidth={1}
                />
              ))}
              {Array.from({ length: n }, (_, i) => (
                <line
                  className={GRID_STROKE}
                  key={i}
                  strokeWidth={1}
                  x1={CX}
                  x2={polar(CX, CY, R, angleOf(i)).x}
                  y1={CY}
                  y2={polar(CX, CY, R, angleOf(i)).y}
                />
              ))}
              <text
                className={TICK_TEXT}
                fontSize={8}
                textAnchor="middle"
                x={CX}
                y={CY - R - 6}
              >
                {fmtNum(scale.ceil)}
                {unit}
              </text>
              {labels.map((label, i) => {
                const p = polar(CX, CY, R + 18, angleOf(i));
                const anchor = anchorAt(p.x);
                return (
                  <text
                    className={AXIS_TEXT}
                    fontSize={10}
                    key={label}
                    textAnchor={anchor}
                    x={p.x}
                    y={p.y + 3}
                  >
                    {label}
                  </text>
                );
              })}
              {series.map((s, si) => {
                const style = toneOf(s.spec.tone, si);
                const pts = s.nums.map((val, i) =>
                  polar(
                    CX,
                    CY,
                    R * Math.min(1, Math.max(0, val / scale.ceil)),
                    angleOf(i)
                  )
                );
                return (
                  <g key={s.spec.name}>
                    <path className={style.soft} d={`${linePath(pts)}Z`} />
                    <path
                      className={style.stroke}
                      d={`${linePath(pts)}Z`}
                      fill="none"
                      strokeLinejoin="round"
                      strokeWidth={1.6}
                    />
                    {pts.map((p, i) => (
                      <circle
                        className={style.fill}
                        cx={p.x}
                        cy={p.y}
                        key={i}
                        r={2}
                      >
                        <title>
                          {`${s.spec.name}${labels[i] === undefined ? "" : ` · ${labels[i]}`} · ${fmtNum(s.nums[i] ?? 0)}${unit ?? ""}`}
                        </title>
                      </circle>
                    ))}
                  </g>
                );
              })}
            </svg>
          )}
          {rest.length > 0 ? (
            <div className={`${TEXT_MICRO} ${TEXT.muted}`}>{rest}</div>
          ) : null}
        </div>
        <ChartLegend
          items={series.map((s, i) => ({
            name: s.spec.name,
            style: toneOf(s.spec.tone, i),
          }))}
        />
      </ChartPanel>
    );
  }
);

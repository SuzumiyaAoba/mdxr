import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { NUMISH, numOf } from "./attrs.js";
import { CODE_CHIP_CLS } from "./bits.js";
import { ChartPanel } from "./chart-bits.js";
import { CHART_TONES, fmtNum, niceBounds, toneOf } from "./chart.js";
import { collectChildProps } from "./children.js";
import { TEXT, TEXT_MICRO } from "./tones.js";

/**
 * Scatter plot — <Point> dots on two auto-scaled numeric axes (x/y props
 * name them). `size` turns a point into a bubble; `name` labels it.
 */

const POINT_SCHEMA = v.looseObject({
  name: v.optional(v.string()),
  size: v.optional(NUMISH),
  tone: v.optional(v.picklist(CHART_TONES)),
  x: NUMISH,
  y: NUMISH,
});

type PointSpec = v.InferOutput<typeof POINT_SCHEMA>;

export const Point = defineComponent(
  {
    description:
      "散布図の1点。<Scatter> の子。x/y は必須、name でラベル、size でバブル化、tone で色",
    schema: POINT_SCHEMA,
  },
  // Standalone use: an `(x, y)` chip so misplaced points still render.
  ({ x, y, name }): ReactElement => (
    <span className={`font-mono ${CODE_CHIP_CLS}`}>
      {nonEmpty(name) ? name : "point"}
      <span className="opacity-70">
        ({x}, {y})
      </span>
    </span>
  )
);

const collectPoints = (
  children: ReactNode
): { pts: { spec: PointSpec; x: number; y: number }[]; rest: ReactNode[] } => {
  const { items, rest } = collectChildProps(
    children,
    Point,
    POINT_SCHEMA,
    "Point"
  );
  const pts = items.flatMap((spec) => {
    const x = numOf(spec.x);
    const y = numOf(spec.y);
    return x === undefined || y === undefined ? [] : [{ spec, x, y }];
  });
  return { pts, rest };
};

const VB_W = 640;
const VB_H = 360;
const PLOT = { bottom: 316, left: 48, right: 628, top: 12 };

const GRID_STROKE = "stroke-neutral-200 dark:stroke-neutral-700";
const BASE_STROKE = "stroke-neutral-300 dark:stroke-neutral-600";
const TICK_TEXT = "fill-neutral-400 dark:fill-neutral-500";

export const Scatter = defineComponent(
  {
    description:
      "散布図コンテナ (2変数の相関)。<Point x y> を並べる。x/y で軸名、size 指定でバブル。軸はデータから自動スケール",
    schema: v.looseObject({
      title: v.optional(v.string()),
      x: v.optional(v.string()),
      y: v.optional(v.string()),
    }),
  },
  ({ title, x, y, children }) => {
    const { pts, rest } = collectPoints(children);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const xExt = niceBounds(Math.min(0, ...xs), Math.max(1, ...xs));
    const yExt = niceBounds(Math.min(0, ...ys), Math.max(1, ...ys));
    const xSpan = xExt.max - xExt.min || 1;
    const ySpan = yExt.max - yExt.min || 1;
    const xOf = (val: number): number =>
      PLOT.left + ((val - xExt.min) / xSpan) * (PLOT.right - PLOT.left);
    const yOf = (val: number): number =>
      PLOT.bottom - ((val - yExt.min) / ySpan) * (PLOT.bottom - PLOT.top);
    const maxSize = Math.max(0, ...pts.map((p) => numOf(p.spec.size) ?? 0));

    return (
      <ChartPanel icon="lucide:chart-scatter" title={title}>
        <div className="px-4 py-3">
          <svg className="h-auto w-full" viewBox={`0 0 ${VB_W} ${VB_H}`}>
            <title>{title ?? "scatter plot"}</title>
            {xExt.ticks.map((t) => (
              <g key={`x${t}`}>
                <line
                  className={GRID_STROKE}
                  strokeDasharray="2 3"
                  strokeWidth={1}
                  x1={xOf(t)}
                  x2={xOf(t)}
                  y1={PLOT.top}
                  y2={PLOT.bottom}
                />
                <text
                  className={TICK_TEXT}
                  fontSize={9}
                  textAnchor="middle"
                  x={xOf(t)}
                  y={PLOT.bottom + 14}
                >
                  {fmtNum(t)}
                </text>
              </g>
            ))}
            {yExt.ticks.map((t) => (
              <g key={`y${t}`}>
                <line
                  className={GRID_STROKE}
                  strokeDasharray="2 3"
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
            <line
              className={BASE_STROKE}
              strokeWidth={1}
              x1={PLOT.left}
              x2={PLOT.left}
              y1={PLOT.top}
              y2={PLOT.bottom}
            />
            {nonEmpty(x) ? (
              <text
                className={TICK_TEXT}
                fontSize={9}
                letterSpacing="0.12em"
                textAnchor="middle"
                x={(PLOT.left + PLOT.right) / 2}
                y={VB_H - 10}
              >
                {x.toUpperCase()}
              </text>
            ) : null}
            {nonEmpty(y) ? (
              <text
                className={TICK_TEXT}
                fontSize={9}
                letterSpacing="0.12em"
                textAnchor="middle"
                transform={`rotate(-90 14 ${(PLOT.top + PLOT.bottom) / 2})`}
                x={14}
                y={(PLOT.top + PLOT.bottom) / 2}
              >
                {y.toUpperCase()}
              </text>
            ) : null}
            {pts.map((p, i) => {
              const style = toneOf(p.spec.tone, i);
              const size = numOf(p.spec.size);
              const r =
                size === undefined || maxSize === 0
                  ? 4
                  : 4 + Math.sqrt(Math.max(0, size) / maxSize) * 10;
              return (
                <g key={i}>
                  <circle
                    className={size === undefined ? style.fill : style.soft}
                    cx={xOf(p.x)}
                    cy={yOf(p.y)}
                    r={r}
                  >
                    <title>
                      {`${p.spec.name ?? "point"} · ${fmtNum(p.x)}, ${fmtNum(p.y)}${size === undefined ? "" : ` · ${fmtNum(size)}`}`}
                    </title>
                  </circle>
                  {size === undefined ? null : (
                    <circle
                      className={style.stroke}
                      cx={xOf(p.x)}
                      cy={yOf(p.y)}
                      fill="none"
                      r={r}
                      strokeWidth={1}
                    />
                  )}
                  {nonEmpty(p.spec.name) ? (
                    <text
                      className="fill-neutral-600 dark:fill-neutral-300"
                      fontSize={9}
                      x={xOf(p.x) + r + 3}
                      y={yOf(p.y) + 3}
                    >
                      {p.spec.name}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
          {rest.length > 0 ? (
            <div className={`${TEXT_MICRO} ${TEXT.muted}`}>{rest}</div>
          ) : null}
        </div>
      </ChartPanel>
    );
  }
);

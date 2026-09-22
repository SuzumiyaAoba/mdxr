import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { attrTrue, BOOLISH_PROP, NUMISH, numOf } from "./attrs.js";
import { CODE_CHIP_CLS } from "./bits.js";
import { ChartPanel } from "./chart-bits.js";
import { CHART_TONES, fmtNum, sectorPath, toneOf } from "./chart.js";
import { collectChildProps } from "./children.js";
import { TEXT, TEXT_MICRO } from "./tones.js";

/**
 * Pie/donut chart — part-of-whole share across <Slice> children. `donut`
 * cuts a center hole carrying the total; legend rows show name · value · %.
 */

const SLICE_SCHEMA = v.looseObject({
  name: v.string(),
  note: v.optional(v.string()),
  tone: v.optional(v.picklist(CHART_TONES)),
  value: NUMISH,
});

type SliceSpec = v.InferOutput<typeof SLICE_SCHEMA>;

export const Slice = defineComponent(
  {
    description:
      "円グラフの1区切り。<PieChart> の子。name/value は必須、tone で色、note で補足",
    schema: SLICE_SCHEMA,
  },
  // Standalone use: a `name value` chip so misplaced slices still render.
  ({ name, value, note }): ReactElement => (
    <span className={`font-mono ${CODE_CHIP_CLS}`}>
      {name}
      <span className="opacity-70">{value}</span>
      {nonEmpty(note) ? <span className="opacity-70">{note}</span> : null}
    </span>
  )
);

const collectSlices = (
  children: ReactNode
): { rest: ReactNode[]; slices: { n: number; spec: SliceSpec }[] } => {
  const { items, rest } = collectChildProps(
    children,
    Slice,
    SLICE_SCHEMA,
    "Slice"
  );
  const slices = items.map((spec) => ({
    n: Math.max(0, numOf(spec.value) ?? 0),
    spec,
  }));
  return { rest, slices };
};

const VB = 200;
const CX = VB / 2;
const CY = VB / 2;
const R1 = 92;
const R0 = 58;

export const PieChart = defineComponent(
  {
    description:
      "円グラフ/ドーナツコンテナ (構成比)。<Slice name value> を並べる。donut で中央に穴 (合計を表示)、unit は凡例の値の単位",
    schema: v.looseObject({
      donut: BOOLISH_PROP,
      title: v.optional(v.string()),
      unit: v.optional(v.string()),
    }),
  },
  ({ title, donut, unit, children }) => {
    const { slices, rest } = collectSlices(children);
    const total = slices.reduce((a, s) => a + s.n, 0);
    const hole = attrTrue(donut);
    let angle = -Math.PI / 2;

    const arcs = slices.map((s, i) => {
      const span = total === 0 ? 0 : (s.n / total) * Math.PI * 2;
      const a0 = angle;
      const a1 = angle + span;
      angle = a1;
      return {
        d: sectorPath(CX, CY, hole ? R0 : 0, R1, a0, a1),
        i,
        s,
      };
    });

    return (
      <ChartPanel
        figure={nonEmpty(unit) ? `${fmtNum(total)}${unit}` : undefined}
        icon="lucide:chart-pie"
        title={title}
      >
        <div className="flex flex-col items-center gap-4 px-4 py-4 sm:flex-row sm:items-start">
          <div className="relative h-44 w-44 shrink-0">
            <svg className="h-full w-full" viewBox={`0 0 ${VB} ${VB}`}>
              <title>{title ?? "pie chart"}</title>
              {total === 0 ? (
                <circle
                  className="fill-neutral-200 dark:fill-neutral-700"
                  cx={CX}
                  cy={CY}
                  r={hole ? (R0 + R1) / 2 : R1}
                />
              ) : null}
              {arcs.map((a) => (
                <path
                  className={toneOf(a.s.spec.tone, a.i).fill}
                  d={a.d}
                  key={a.i}
                >
                  <title>
                    {`${a.s.spec.name} · ${fmtNum(a.s.n)}${unit ?? ""} (${total === 0 ? 0 : Math.round((a.s.n / total) * 100)}%)`}
                  </title>
                </path>
              ))}
            </svg>
            {hole ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-lg font-semibold tabular-nums">
                  {fmtNum(total)}
                </span>
                {nonEmpty(unit) ? (
                  <span className={`${TEXT_MICRO} ${TEXT.faint}`}>{unit}</span>
                ) : null}
              </div>
            ) : null}
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5 self-center sm:self-auto">
            {slices.map((s, i) => {
              const style = toneOf(s.spec.tone, i);
              const pct = total === 0 ? 0 : (s.n / total) * 100;
              return (
                <li
                  className="flex items-baseline gap-2 text-sm"
                  key={s.spec.name}
                >
                  <span
                    className={`h-2 w-2 shrink-0 self-center rounded-[2px] ${style.bg}`}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {s.spec.name}
                    {nonEmpty(s.spec.note) ? (
                      <span className={`ml-1.5 ${TEXT_MICRO} ${TEXT.faint}`}>
                        {s.spec.note}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`font-mono ${TEXT_MICRO} tabular-nums ${TEXT.muted}`}
                  >
                    {fmtNum(s.n)}
                    {unit}
                    {` · ${Math.round(pct)}%`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        {rest.length > 0 ? <div className="px-4 pb-3">{rest}</div> : null}
      </ChartPanel>
    );
  }
);

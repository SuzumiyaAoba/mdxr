import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren, parseProps } from "../define.js";
import { nonEmpty } from "../guards.js";
import { attrTrue, BOOLISH_PROP, NUMISH, numOf } from "./attrs.js";
import { CODE_CHIP_CLS } from "./bits.js";
import { ChartPanel } from "./chart-bits.js";
import { fmtNum, niceBounds } from "./chart.js";
import { isEl } from "./children.js";
import { RAIL_BG_CLS, TEXT, TEXT_MICRO, TEXT_SUB, TONE_TEXT } from "./tones.js";

/**
 * Bridge / running-total waterfall — a start total carried to an end total
 * by signed <Delta> contributions. `total` pillars re-anchor the running
 * sum at their value; deltas float from the previous sum to the new one.
 */

const DELTA_SCHEMA = v.looseObject({
  name: v.string(),
  note: v.optional(v.string()),
  total: BOOLISH_PROP,
  value: NUMISH,
});

type DeltaSpec = v.InferOutput<typeof DELTA_SCHEMA>;

export const Delta = defineComponent(
  {
    description:
      "ブリッジの1増減。<Bridge> の子。name/value は必須 (value は符号付き)、total で累計の柱 (0→value)、note で補足",
    schema: DELTA_SCHEMA,
  },
  // Standalone use: a `name ±value` chip so misplaced deltas still render.
  ({ name, value, total }): ReactElement => (
    <span className={`font-mono ${CODE_CHIP_CLS}`}>
      {name}
      <span className="opacity-70">
        {attrTrue(total) ? "=" : ""}
        {value}
      </span>
    </span>
  )
);

interface Step {
  /** Column top (larger of from/to). */
  high: number;
  /** Column bottom (smaller of from/to). */
  low: number;
  n: number;
  spec: DeltaSpec;
  /** Running total after this step. */
  sum: number;
}

/** Bar color — neutral for totals, emerald/red for up/down deltas. */
const barCls = (isTotal: boolean, positive: boolean): string => {
  if (isTotal) {
    return "bg-neutral-400";
  }
  return positive ? "bg-emerald-500" : "bg-red-500";
};

/** Value label color matching barCls. */
const valueCls = (isTotal: boolean, positive: boolean): string => {
  if (isTotal) {
    return TEXT.muted;
  }
  return positive ? TONE_TEXT.emerald : TONE_TEXT.red;
};

const collectDeltas = (
  children: ReactNode
): { rest: ReactNode[]; steps: Step[] } => {
  const steps: Step[] = [];
  const rest: ReactNode[] = [];
  let sum = 0;
  for (const child of flattenChildren(children)) {
    if (isEl(child, Delta)) {
      const spec = parseProps(DELTA_SCHEMA, child.props, "Delta");
      const n = numOf(spec.value) ?? 0;
      const isTotal = attrTrue(spec.total);
      const low = isTotal ? Math.min(0, n) : Math.min(sum, sum + n);
      const high = isTotal ? Math.max(0, n) : Math.max(sum, sum + n);
      sum = isTotal ? n : sum + n;
      steps.push({ high, low, n, spec, sum });
    } else {
      rest.push(child);
    }
  }
  return { rest, steps };
};

export const Bridge = defineComponent(
  {
    description:
      "ブリッジコンテナ (開始値→増減→終了値の waterfall チャート)。<Delta name value> を並べる。value は符号付き、total で絶対値の柱。unit は値の単位",
    schema: v.looseObject({
      title: v.optional(v.string()),
      unit: v.optional(v.string()),
    }),
  },
  ({ title, unit, children }) => {
    const { steps, rest } = collectDeltas(children);
    const ext = niceBounds(
      Math.min(0, ...steps.map((s) => s.low)),
      Math.max(1, ...steps.map((s) => s.high))
    );
    const span = ext.max - ext.min || 1;
    const pctOf = (val: number): number => ((val - ext.min) / span) * 100;

    return (
      <ChartPanel
        figure={
          nonEmpty(unit)
            ? `${fmtNum(ext.min)}–${fmtNum(ext.max)}${unit}`
            : undefined
        }
        icon="lucide:chart-column-big"
        title={title}
      >
        <div className="px-4 py-3">
          <div className="relative">
            <div aria-hidden className="absolute inset-0 h-36">
              {ext.ticks
                .filter((t) => t > ext.min && t < ext.max)
                .map((t) => (
                  <div
                    className={`absolute h-px w-full ${RAIL_BG_CLS} ${t === 0 ? "" : "opacity-50"}`}
                    key={t}
                    style={{ bottom: `${pctOf(t)}%` }}
                  />
                ))}
            </div>
            <div className="relative flex h-36 items-stretch gap-x-3">
              {steps.map((s, i) => {
                const isTotal = attrTrue(s.spec.total);
                const cls = barCls(isTotal, s.n >= 0);
                const prevSum = i === 0 ? undefined : steps[i - 1]?.sum;
                return (
                  <div className="min-w-0 flex-1" key={i}>
                    <div className="relative h-full">
                      <div
                        className={`absolute w-full rounded-sm ${cls}`}
                        style={{
                          bottom: `${pctOf(s.low)}%`,
                          height: `${Math.max(1, pctOf(s.high) - pctOf(s.low))}%`,
                        }}
                        title={`${s.spec.name} · ${fmtNum(s.n)}${unit ?? ""} → ${fmtNum(s.sum)}`}
                      />
                      {/* connector at the previous column's running total */}
                      {prevSum === undefined ? null : (
                        <div
                          aria-hidden
                          className={`absolute -left-3 h-px w-3 ${RAIL_BG_CLS}`}
                          style={{ bottom: `${pctOf(prevSum)}%` }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-x-3">
            {steps.map((s, i) => {
              const isTotal = attrTrue(s.spec.total);
              const positive = s.n >= 0;
              return (
                <div className="min-w-0 flex-1" key={i}>
                  <div className="mt-1 truncate text-center text-xs">
                    {s.spec.name}
                  </div>
                  <div
                    className={`truncate text-center font-mono ${TEXT_MICRO} tabular-nums ${valueCls(isTotal, positive)}`}
                  >
                    {isTotal
                      ? fmtNum(s.n)
                      : `${positive ? "+" : ""}${fmtNum(s.n)}`}
                  </div>
                  {nonEmpty(s.spec.note) ? (
                    <div
                      className={`truncate text-center ${TEXT_SUB} ${TEXT.faint}`}
                    >
                      {s.spec.note}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div
            className={`mt-1 flex justify-between font-mono ${TEXT_MICRO} ${TEXT.faint} tabular-nums`}
          >
            <span>{fmtNum(ext.min)}</span>
            <span>
              {fmtNum(ext.max)}
              {unit}
            </span>
          </div>
        </div>
        {rest.length > 0 ? <div className="px-4 pb-3">{rest}</div> : null}
      </ChartPanel>
    );
  }
);

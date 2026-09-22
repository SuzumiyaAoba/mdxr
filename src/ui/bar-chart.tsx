import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { attrTrue, BOOLISH_PROP, NUMISH, numOf } from "./attrs.js";
import { CODE_CHIP_CLS } from "./bits.js";
import { ChartLegend, ChartPanel } from "./chart-bits.js";
import {
  CHART_TONES,
  fmtNum,
  niceScale,
  numList,
  textList,
  toneOf,
} from "./chart.js";
import { collectChildProps } from "./children.js";
import { RAIL_BG_CLS, TEXT, TEXT_MICRO, TEXT_SUB, TRACK_CLS } from "./tones.js";

/**
 * Bar/column chart — categorical comparison with optional multi-series
 * bars (`values` on `<Bar>` + `series` names on `<BarChart>`). Vertical
 * columns are the default; `direction="horizontal"` flips to labeled rows
 * for long names or many categories.
 */

const BAR_SCHEMA = v.looseObject({
  name: v.string(),
  note: v.optional(v.string()),
  tone: v.optional(v.picklist(CHART_TONES)),
  value: v.optional(NUMISH),
  values: v.optional(v.string()),
});

type BarSpec = v.InferOutput<typeof BAR_SCHEMA> & { nums: number[] };

export const Bar = defineComponent(
  {
    description:
      'バーチャートの1カテゴリ。<BarChart> の子。name/value は必須。values="12,8" で複数系列 (series 名は <BarChart> の series で指定)、tone で色指定',
    schema: BAR_SCHEMA,
  },
  // Standalone use: a `name value` chip so misplaced bars still render.
  ({ name, value, values, note }): ReactElement => (
    <span className={`font-mono ${CODE_CHIP_CLS}`}>
      {name}
      <span className="opacity-70">{nonEmpty(values) ? values : value}</span>
      {nonEmpty(note) ? <span className="opacity-70">{note}</span> : null}
    </span>
  )
);

/** Splits children into <Bar> specs (parsed, with numeric lists) and rest. */
const collectBars = (
  children: ReactNode
): { bars: BarSpec[]; rest: ReactNode[] } => {
  const { items, rest } = collectChildProps(children, Bar, BAR_SCHEMA, "Bar");
  const bars = items.map((spec) => {
    const value = numOf(spec.value);
    const single = value === undefined ? [] : [value];
    return {
      ...spec,
      nums: nonEmpty(spec.values) ? numList(spec.values) : single,
    };
  });
  return { bars, rest };
};

/** Horizontal guide lines shared by every column's plot area. */
const Guides = (props: { ceil: number; ticks: number[] }): ReactElement => (
  <>
    <div
      aria-hidden
      className={`absolute bottom-0 h-px w-full ${RAIL_BG_CLS}`}
    />
    {props.ticks.map((t) => (
      <div
        aria-hidden
        className={`absolute h-px w-full ${RAIL_BG_CLS} opacity-50`}
        key={t}
        style={{ bottom: `${(t / props.ceil) * 100}%` }}
      />
    ))}
  </>
);

const BAR_MIN_PCT = 0.8;

/** One vertical column — value label, stacked/grouped bars, category name. */
const Column = (props: {
  bar: BarSpec;
  ceil: number;
  stacked: boolean;
}): ReactElement => {
  const { bar, ceil } = props;
  const total = bar.nums.reduce((a, b) => a + b, 0);
  const single = bar.nums.length <= 1;
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-36 flex-col items-center justify-end">
        {single || props.stacked ? (
          <span
            className={`font-mono ${TEXT_MICRO} tabular-nums ${TEXT.muted}`}
          >
            {fmtNum(total)}
          </span>
        ) : null}
        {props.stacked ? (
          <div
            className="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-t-sm"
            style={{ height: `${Math.min(100, (total / ceil) * 100)}%` }}
            title={`${bar.name} · ${fmtNum(total)}`}
          >
            {bar.nums.map((n, k) => (
              <div
                className={`w-full ${toneOf(undefined, k).bg}`}
                key={k}
                style={{
                  height: `${total === 0 ? 0 : (n / total) * 100}%`,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-0 w-full max-w-16 flex-1 items-end justify-center gap-0.5">
            {bar.nums.map((n, k) => (
              <div
                className={`min-w-1 flex-1 rounded-t-sm ${toneOf(single ? bar.tone : undefined, k).bg}`}
                key={k}
                style={{
                  height: `${Math.min(100, Math.max(n > 0 ? BAR_MIN_PCT : 0, (n / ceil) * 100))}%`,
                }}
                title={`${bar.name} · ${fmtNum(n)}`}
              />
            ))}
          </div>
        )}
      </div>
      <div className="mt-1 truncate text-center text-xs">{bar.name}</div>
      {nonEmpty(bar.note) ? (
        <div className={`truncate text-center ${TEXT_SUB} ${TEXT.faint}`}>
          {bar.note}
        </div>
      ) : null}
    </div>
  );
};

/** The track cell of a horizontal row — stacked band, single bar, or thin grouped bars. */
const HTrack = (props: {
  bar: BarSpec;
  ceil: number;
  stacked: boolean;
  total: number;
}): ReactElement => {
  const { bar, ceil, total } = props;
  if (props.stacked) {
    return (
      <div className={`flex h-2.5 overflow-hidden rounded ${TRACK_CLS}`}>
        {bar.nums.map((n, k) => (
          <div
            className={`h-full ${toneOf(undefined, k).bg}`}
            key={k}
            style={{ width: `${(n / ceil) * 100}%` }}
          />
        ))}
      </div>
    );
  }
  if (bar.nums.length <= 1) {
    return (
      <div className={`relative h-4.5 rounded ${TRACK_CLS}`}>
        <div
          className={`absolute inset-y-0 rounded ${toneOf(bar.tone, 0).bg}`}
          style={{
            width: `${Math.min(100, Math.max(total > 0 ? BAR_MIN_PCT : 0, (total / ceil) * 100))}%`,
          }}
        />
      </div>
    );
  }
  return (
    <div
      className={`flex h-5 flex-col justify-center gap-0.5 rounded ${TRACK_CLS} px-1`}
    >
      {bar.nums.map((n, k) => (
        <div
          className={`h-1 rounded-full ${toneOf(undefined, k).bg}`}
          key={k}
          style={{ width: `${Math.min(100, (n / ceil) * 100)}%` }}
        />
      ))}
    </div>
  );
};

/** One horizontal row — label, track with bars, value. */
const HRow = (props: {
  bar: BarSpec;
  ceil: number;
  stacked: boolean;
}): ReactElement => {
  const { bar, ceil } = props;
  const total = bar.nums.reduce((a, b) => a + b, 0);
  return (
    <div className="grid grid-cols-[minmax(6rem,9rem)_minmax(0,1fr)_4.5rem] items-center gap-x-3 py-1">
      <div className="min-w-0">
        <div className="truncate text-sm">{bar.name}</div>
        {nonEmpty(bar.note) ? (
          <div className={`truncate ${TEXT_SUB} ${TEXT.faint}`}>{bar.note}</div>
        ) : null}
      </div>
      <HTrack bar={bar} ceil={ceil} stacked={props.stacked} total={total} />
      <div
        className={`text-right font-mono ${TEXT_MICRO} tabular-nums ${TEXT.muted}`}
      >
        {fmtNum(total)}
      </div>
    </div>
  );
};

export const BarChart = defineComponent(
  {
    description:
      'バーチャートコンテナ (カテゴリ比較)。<Bar name value> を並べる。direction="horizontal" で横棒、stacked で積み上げ、series="a,b" で系列名 (凡例)、max/unit でスケールと単位',
    schema: v.looseObject({
      direction: v.optional(v.picklist(["vertical", "horizontal"]), "vertical"),
      max: v.optional(NUMISH),
      series: v.optional(v.string()),
      stacked: BOOLISH_PROP,
      title: v.optional(v.string()),
      unit: v.optional(v.string()),
    }),
  },
  ({ title, direction, max, series, stacked, unit, children }) => {
    const { bars, rest } = collectBars(children);
    const isStacked = attrTrue(stacked);
    const seriesNames = textList(series);
    const maxTotal = Math.max(
      0,
      ...bars.map((b) =>
        isStacked ? b.nums.reduce((a, n) => a + n, 0) : Math.max(0, ...b.nums)
      )
    );
    const scale = niceScale(numOf(max) ?? maxTotal);
    const seriesCount = Math.max(1, ...bars.map((b) => b.nums.length));
    let legend: { name: string; style: ReturnType<typeof toneOf> }[] = [];
    if (seriesNames.length > 0) {
      legend = seriesNames.map((name, i) => ({
        name,
        style: toneOf(undefined, i),
      }));
    } else if (seriesCount > 1) {
      legend = Array.from({ length: seriesCount }, (_, i) => ({
        name: `s${i + 1}`,
        style: toneOf(undefined, i),
      }));
    }
    const horizontal = direction === "horizontal";

    return (
      <ChartPanel
        figure={nonEmpty(unit) ? `0–${fmtNum(scale.ceil)}${unit}` : undefined}
        icon={horizontal ? "lucide:chart-bar" : "lucide:chart-column"}
        title={title}
      >
        <div className="px-4 py-3">
          {horizontal ? (
            <>
              <div className="grid grid-cols-[minmax(6rem,9rem)_minmax(0,1fr)_4.5rem] gap-x-3 pb-1">
                <span />
                <span
                  className={`flex justify-between font-mono ${TEXT_MICRO} ${TEXT.faint} tabular-nums`}
                >
                  <span>0</span>
                  <span>
                    {fmtNum(scale.ceil)}
                    {unit}
                  </span>
                </span>
                <span />
              </div>
              {bars.map((bar) => (
                <HRow
                  bar={bar}
                  ceil={scale.ceil}
                  key={bar.name}
                  stacked={isStacked}
                />
              ))}
            </>
          ) : (
            <>
              <div className="relative">
                <div aria-hidden className="absolute inset-0 h-36">
                  <Guides ceil={scale.ceil} ticks={scale.ticks} />
                </div>
                <div className="relative flex items-end gap-x-3">
                  {bars.map((bar) => (
                    <Column
                      bar={bar}
                      ceil={scale.ceil}
                      key={bar.name}
                      stacked={isStacked}
                    />
                  ))}
                </div>
              </div>
              <div
                className={`mt-1 flex justify-between font-mono ${TEXT_MICRO} ${TEXT.faint} tabular-nums`}
              >
                <span>0</span>
                <span>
                  {fmtNum(scale.ceil)}
                  {unit}
                </span>
              </div>
            </>
          )}
        </div>
        <ChartLegend items={legend} />
        {rest.length > 0 ? <div className="px-4 pb-3">{rest}</div> : null}
      </ChartPanel>
    );
  }
);

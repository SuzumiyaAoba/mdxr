import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { NUMISH, numOf } from "./attrs.js";
import { CODE_CHIP_CLS } from "./bits.js";
import { ChartPanel } from "./chart-bits.js";
import { CHART_TONES, fmtNum, toneOf } from "./chart.js";
import { collectChildProps } from "./children.js";
import { TEXT, TEXT_MICRO } from "./tones.js";

/**
 * Funnel/pyramid — centered bars shrinking through <Stage> rows. Each row
 * carries the stage value and its share of the first stage; conversion
 * between adjacent stages shows on the left when it drops.
 */

const STAGE_SCHEMA = v.looseObject({
  name: v.string(),
  note: v.optional(v.string()),
  tone: v.optional(v.picklist(CHART_TONES)),
  value: NUMISH,
});

type StageSpec = v.InferOutput<typeof STAGE_SCHEMA>;

export const Stage = defineComponent(
  {
    description:
      "ファネルの1段。<Funnel> の子。name/value は必須、note で補足、tone で色指定",
    schema: STAGE_SCHEMA,
  },
  // Standalone use: a `name value` chip so misplaced stages still render.
  ({ name, value, note }): ReactElement => (
    <span className={`font-mono ${CODE_CHIP_CLS}`}>
      {name}
      <span className="opacity-70">{value}</span>
      {nonEmpty(note) ? <span className="opacity-70">{note}</span> : null}
    </span>
  )
);

const collectStages = (
  children: ReactNode
): { rest: ReactNode[]; stages: { n: number; spec: StageSpec }[] } => {
  const { items, rest } = collectChildProps(
    children,
    Stage,
    STAGE_SCHEMA,
    "Stage"
  );
  const stages = items.map((spec) => ({
    n: Math.max(0, numOf(spec.value) ?? 0),
    spec,
  }));
  return { rest, stages };
};

export const Funnel = defineComponent(
  {
    description:
      "ファネルコンテナ (段階ごとの絞り込み/ピラミッド)。<Stage name value> を上から順に並べる。unit は値の単位",
    schema: v.looseObject({
      title: v.optional(v.string()),
      unit: v.optional(v.string()),
    }),
  },
  ({ title, unit, children }) => {
    const { stages, rest } = collectStages(children);
    const first = stages[0]?.n ?? 0;
    const max = Math.max(0, ...stages.map((s) => s.n));
    return (
      <ChartPanel
        figure={
          nonEmpty(unit) && first > 0 ? `${fmtNum(first)}${unit}` : undefined
        }
        icon="lucide:funnel"
        title={title}
      >
        <div className="space-y-1.5 px-4 py-3">
          {stages.map((s, i) => {
            const prev = i === 0 ? undefined : stages[i - 1]?.n;
            const conv =
              prev !== undefined && prev > 0 ? (s.n / prev) * 100 : undefined;
            const share = first === 0 ? 0 : (s.n / first) * 100;
            const width = max === 0 ? 0 : (s.n / max) * 100;
            return (
              <div className="flex items-center gap-2" key={s.spec.name}>
                <span
                  className={`w-12 shrink-0 text-right font-mono ${TEXT_MICRO} tabular-nums ${TEXT.faint}`}
                >
                  {conv === undefined ? "" : `${Math.round(conv)}%`}
                </span>
                <div className="flex min-w-0 flex-1 justify-center">
                  <div
                    className={`flex h-7 min-w-10 items-center justify-center rounded ${toneOf(s.spec.tone, i).bg}`}
                    style={{ width: `${Math.max(8, width)}%` }}
                    title={`${s.spec.name} · ${fmtNum(s.n)}${unit ?? ""}`}
                  >
                    <span className="truncate px-2 text-xs font-medium text-white dark:text-neutral-900">
                      {s.spec.name}
                    </span>
                  </div>
                </div>
                <span
                  className={`w-24 shrink-0 font-mono ${TEXT_MICRO} tabular-nums ${TEXT.muted}`}
                >
                  {fmtNum(s.n)}
                  {unit}
                  {i === 0 ? "" : ` · ${Math.round(share)}%`}
                </span>
              </div>
            );
          })}
        </div>
        {rest.length > 0 ? <div className="px-4 pb-3">{rest}</div> : null}
      </ChartPanel>
    );
  }
);

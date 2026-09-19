import { createContext, useContext } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { numOf, NUMISH } from "./attrs.js";
import { CaptionBar, ListPanel, ListRow, RowNote } from "./bits.js";
import { Icon } from "./icon.js";
import {
  CAPTION_TITLE_CLS,
  COUNT_CHIP_CLS,
  MINI_CHIP_CLS,
  TEXT,
  TEXT_SUB,
  TONE,
  TRIM_CLS,
} from "./tones.js";

export const BENCH_BETTER = ["higher", "lower"] as const;
export type BenchBetter = (typeof BENCH_BETTER)[number];

/** `better` from <Benchmarks> — which direction is an improvement. */
const BetterCtx = createContext<BenchBetter>("higher");

/** Signed pct change, formatted `+21%` / `−8%` / `±0%`. */
const deltaOf = (before: number, after: number): string => {
  if (before === 0) {
    return after === 0 ? "±0%" : "+∞";
  }
  const d = ((after - before) / Math.abs(before)) * 100;
  if (Math.abs(d) < 0.5) {
    return "±0%";
  }
  const rounded = Math.abs(d) >= 100 ? Math.round(d) : Math.round(d * 10) / 10;
  return `${d > 0 ? "+" : "−"}${Math.abs(rounded)}%`;
};

interface DeltaView {
  cls: string;
  icon: string;
  text: string;
}

/** before/after の変化率チップ。undefined = 計算不能 (非数値入力)。 */
const deltaView = (
  before: number | undefined,
  after: number | undefined,
  better: BenchBetter
): DeltaView | undefined => {
  if (before === undefined || after === undefined) {
    return undefined;
  }
  const text = deltaOf(before, after);
  if (text === "±0%") {
    return { cls: TONE.neutral, icon: "lucide:minus", text };
  }
  const improved = better === "lower" ? after < before : after > before;
  return improved
    ? { cls: TONE.emerald, icon: "lucide:trending-up", text }
    : { cls: TONE.red, icon: "lucide:trending-down", text };
};

export const Bench = defineComponent(
  {
    description:
      'ベンチマーク比較1行。name は必須、before → after を表示し変化率を自動計算。<Benchmarks better="lower"> の中では減少が改善 (緑) になる。unit で単位表示、children はメモ',
    schema: v.looseObject({
      after: NUMISH,
      before: NUMISH,
      name: v.string(),
      note: v.optional(v.string()),
      unit: v.optional(v.string()),
    }),
  },
  ({ name, before, after, unit, note, children }) => {
    const better = useContext(BetterCtx);
    const delta = deltaView(numOf(before), numOf(after), better);
    return (
      <ListRow>
        <Icon
          className={`h-3.5 w-3.5 shrink-0 self-center ${TEXT.faint}`}
          name="lucide:timer"
        />
        <span className="text-sm">{name}</span>
        <span className="inline-flex items-baseline gap-1.5 font-mono text-xs tabular-nums">
          <span className={TEXT.muted}>
            {String(before)}
            {nonEmpty(unit) ? unit : ""}
          </span>
          <Icon
            className={`h-3 w-3 self-center ${TEXT.faint}`}
            name="lucide:arrow-right"
          />
          <span className={TEXT.code}>
            {String(after)}
            {nonEmpty(unit) ? unit : ""}
          </span>
        </span>
        {delta === undefined ? null : (
          <span className={`${MINI_CHIP_CLS} ${delta.cls}`}>
            <Icon className="h-2.5 w-2.5" name={delta.icon} />
            {delta.text}
          </span>
        )}
        {nonEmpty(note) ? (
          <span className={`text-sm ${TEXT.muted}`}>{note}</span>
        ) : null}
        <RowNote className={TRIM_CLS}>{children}</RowNote>
      </ListRow>
    );
  }
);

export const Benchmarks = defineComponent(
  {
    description:
      "ベンチマーク比較一覧のコンテナ。<Bench> を並べる。better は higher|lower (高い方/低い方が良い) で Δ の色判定を反転。title/unit はキャプション",
    schema: v.looseObject({
      better: v.optional(v.picklist(BENCH_BETTER), "higher"),
      title: v.optional(v.string()),
      unit: v.optional(v.string()),
    }),
  },
  ({ title, unit, better, children }) => (
    <ListPanel>
      {nonEmpty(title) || nonEmpty(unit) ? (
        <CaptionBar className={CAPTION_TITLE_CLS}>
          <Icon className="h-3.5 w-3.5" name="lucide:gauge" />
          {nonEmpty(title) ? title : "Benchmarks"}
          <span
            className={`ml-auto flex items-center gap-x-2 font-normal ${TEXT_SUB}`}
          >
            <span className={COUNT_CHIP_CLS}>{better} is better</span>
            {nonEmpty(unit) ? (
              <span className={`font-mono ${TEXT.faint}`}>{unit}</span>
            ) : null}
          </span>
        </CaptionBar>
      ) : null}
      <BetterCtx.Provider value={better}>{children}</BetterCtx.Provider>
    </ListPanel>
  )
);

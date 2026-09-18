import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { nonEmpty } from "../guards.js";
import { CaptionBar, Panel } from "./bits.js";
import { indexChildren, useChildIndex } from "./child-index.js";
import { isEl, propOf } from "./children.js";
import { Icon } from "./icon.js";
import { TEXT } from "./tones.js";

/**
 * Timing waterfall — horizontal span bars like an OTel trace view. `start`
 * and `duration` accept numbers or strings with a unit suffix ("120ms",
 * "1.2s"); the bar scale is `total` (defaults to the latest span end).
 */

const PALETTE = [
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-teal-500",
] as const;

/** Numeric part of `"120"`, `"120ms"`, `"1.2s"` — unit text is dropped. */
const num = (x: unknown): number | undefined => {
  if (typeof x === "number") {
    return Number.isFinite(x) ? x : undefined;
  }
  if (typeof x !== "string") {
    return undefined;
  }
  const m = /^\s*(?<n>\d+(?:\.\d+)?)/u.exec(x);
  return m?.groups === undefined ? undefined : Number(m.groups.n);
};

/** Scale (same units as Span start/duration) handed down by <Waterfall>. */
const ScaleCtx = createContext(1);

export const Span = defineComponent(
  {
    description:
      'ウォーターフォールの1区間。name は必須、duration も必須 (数値または "120ms")。start で開始オフセット、note で補足。バーの色は行番号で自動',
    schema: v.looseObject({
      duration: v.union([v.string(), v.number()]),
      name: v.string(),
      note: v.optional(v.string()),
      start: v.optional(v.union([v.string(), v.number()])),
    }),
  },
  ({ name, duration, note, start }) => {
    const scale = useContext(ScaleCtx);
    const { n } = useChildIndex();
    const cls = PALETTE[(n > 0 ? n - 1 : 0) % PALETTE.length];
    const s = num(start) ?? 0;
    const d = num(duration) ?? 0;
    const left = Math.min(100, Math.max(0, (s / scale) * 100));
    const width = Math.min(100 - left, Math.max(0.4, (d / scale) * 100));
    return (
      <div className="grid grid-cols-[minmax(6rem,9rem)_minmax(0,1fr)_4.5rem] items-center gap-x-3 py-1">
        <div className="min-w-0">
          <div className="truncate text-sm">{name}</div>
          {nonEmpty(note) ? (
            <div className={`truncate text-[0.7rem] ${TEXT.faint}`}>{note}</div>
          ) : null}
        </div>
        <div className="relative h-4.5 rounded bg-neutral-100 dark:bg-neutral-800">
          <div
            className={`absolute inset-y-0 rounded ${cls}`}
            style={{ left: `${left}%`, width: `${width}%` }}
          />
        </div>
        <div
          className={`text-right font-mono text-xs tabular-nums ${TEXT.muted}`}
        >
          {String(duration)}
        </div>
      </div>
    );
  }
);

const spanDuration = (node: ReactNode): number | undefined => {
  if (!isEl(node, Span)) {
    return undefined;
  }
  const duration = num(propOf(node, "duration"));
  if (duration === undefined) {
    return undefined;
  }
  return (num(propOf(node, "start")) ?? 0) + duration;
};

export const Waterfall = defineComponent(
  {
    description:
      "タイミングの滝グラフコンテナ (OTel トレース風)。<Span> を並べる。total でスケール上限を上書き (省略時は最終 end)、unit は total 表示用の単位",
    schema: v.looseObject({
      title: v.optional(v.string()),
      total: v.optional(v.union([v.string(), v.number()])),
      unit: v.optional(v.string(), "ms"),
    }),
  },
  ({ title, total, unit, children }) => {
    const ends = flattenChildren(children)
      .map(spanDuration)
      .filter((e): e is number => e !== undefined);
    let maxEnd = 0;
    for (const e of ends) {
      maxEnd = Math.max(maxEnd, e);
    }
    const totalNum = num(total) ?? maxEnd;
    const scale = totalNum > 0 ? totalNum : 1;
    return (
      <Panel>
        {nonEmpty(title) ? (
          <CaptionBar className="flex items-center gap-2 font-medium">
            <Icon className="h-3.5 w-3.5" name="lucide:chart-bar" />
            <span className="min-w-0 flex-1 truncate">{title}</span>
            <span className="font-mono font-normal tabular-nums">
              {totalNum}
              {unit}
            </span>
          </CaptionBar>
        ) : null}
        <div className="px-4 py-3">
          <div className="grid grid-cols-[minmax(6rem,9rem)_minmax(0,1fr)_4.5rem] gap-x-3 pb-1">
            <span />
            <span className="flex justify-between font-mono text-[0.62rem] text-neutral-400 tabular-nums dark:text-neutral-500">
              <span>0</span>
              <span>
                {totalNum}
                {unit}
              </span>
            </span>
            <span />
          </div>
          <ScaleCtx.Provider value={scale}>
            {indexChildren(children)}
          </ScaleCtx.Provider>
        </div>
      </Panel>
    );
  }
);

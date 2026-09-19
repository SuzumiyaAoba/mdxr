import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { LINK_LINES_PROPS, numOf, NUMISH } from "./attrs.js";
import { CaptionBar, ListPanel, MaybeLink } from "./bits.js";
import { useFileLink } from "./file-link.js";
import { Icon } from "./icon.js";
import { CAPTION_TITLE_CLS, TEXT, TEXT_SUB, TRACK_CLS } from "./tones.js";

export const GAUGE_TONES = [
  "emerald",
  "amber",
  "red",
  "sky",
  "violet",
  "neutral",
] as const;
export type GaugeTone = (typeof GAUGE_TONES)[number];

const FILL_CLS: Record<GaugeTone, string> = {
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  neutral: "bg-neutral-400 dark:bg-neutral-500",
  red: "bg-red-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
};

/** `pct`/`target` → pass/fail tone; without a target, graded 80/50 bands. */
const autoTone = (pct: number, target: number | undefined): GaugeTone => {
  if (target !== undefined) {
    return pct >= target ? "emerald" : "red";
  }
  if (pct >= 80) {
    return "emerald";
  }
  if (pct >= 50) {
    return "amber";
  }
  return "red";
};

export const Gauge = defineComponent(
  {
    description:
      'ラベル付きパーセントバー1行。value (0-100 または value/max) は必須。target で閾値判定 (未達は赤)、tone で色指定可。label/path で行ラベル、path は実ファイルへのエディタリンク、detail に補足 ("412/500 lines" など)。カバレッジ・スコア・進捗の定量表示向け',
    schema: v.looseObject({
      ...LINK_LINES_PROPS,
      detail: v.optional(v.string()),
      label: v.optional(v.string()),
      max: v.optional(NUMISH),
      path: v.optional(v.string()),
      target: v.optional(NUMISH),
      tone: v.optional(v.picklist(GAUGE_TONES)),
      value: NUMISH,
    }),
  },
  ({ value, max, target, tone, label, path, lines, href, detail }) => {
    const vNum = numOf(value) ?? 0;
    const mNum = numOf(max);
    const tNum = numOf(target);
    const pct =
      mNum !== undefined && mNum > 0
        ? Math.min(100, Math.max(0, (vNum / mNum) * 100))
        : Math.min(100, Math.max(0, vNum));
    const t = tone ?? autoTone(pct, tNum);
    const shown =
      mNum === undefined ? `${Math.round(pct * 10) / 10}%` : `${vNum}/${mNum}`;
    const link = useFileLink(path, lines, href);
    const name = nonEmpty(label) ? label : path;
    return (
      <div className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          {name === undefined ? null : (
            <MaybeLink
              className={`w-44 shrink-0 truncate font-mono text-xs ${TEXT.code} no-underline hover:underline`}
              href={link}
            >
              {name}
            </MaybeLink>
          )}
          <div
            className={`h-2 flex-1 overflow-hidden rounded-full ${TRACK_CLS}`}
          >
            <div
              className={`h-full rounded-full ${FILL_CLS[t]}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span
            className={`shrink-0 font-mono text-xs tabular-nums ${TEXT.muted}`}
          >
            {shown}
            {tNum === undefined ? null : (
              <span className={TEXT.faint}> / {String(target)}</span>
            )}
          </span>
        </div>
        {nonEmpty(detail) ? (
          <div className={`mt-1 ${TEXT_SUB} ${TEXT.faint}`}>{detail}</div>
        ) : null}
      </div>
    );
  }
);

export const Gauges = defineComponent(
  {
    description:
      "パーセントバー一覧のコンテナ。<Gauge> を並べる。title はキャプション。カバレッジレポート・スコア一覧・進捗内訳向け",
    schema: v.looseObject({
      title: v.optional(v.string()),
      unit: v.optional(v.string()),
    }),
  },
  ({ title, unit, children }) => (
    <ListPanel>
      {nonEmpty(title) || nonEmpty(unit) ? (
        <CaptionBar className={CAPTION_TITLE_CLS}>
          <Icon className="h-3.5 w-3.5" name="lucide:gauge" />
          {nonEmpty(title) ? title : "Gauges"}
          {nonEmpty(unit) ? (
            <span
              className={`ml-auto font-mono ${TEXT_SUB} font-normal ${TEXT.faint}`}
            >
              {unit}
            </span>
          ) : null}
        </CaptionBar>
      ) : null}
      {children}
    </ListPanel>
  )
);

import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { numOf, NUMISH } from "./attrs.js";
import { BORDER_CLS, TEXT, TEXT_SUB } from "./tones.js";

type Band = "amber" | "emerald" | "red";

const STROKE_CLS: Record<Band, string> = {
  amber: "stroke-amber-500",
  emerald: "stroke-emerald-500",
  red: "stroke-red-500",
};

const TEXT_BAND: Record<Band, string> = {
  amber: "text-amber-600 dark:text-amber-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  red: "text-red-600 dark:text-red-400",
};

const bandOf = (pct: number): Band => {
  if (pct >= 80) {
    return "emerald";
  }
  if (pct >= 50) {
    return "amber";
  }
  return "red";
};

/** `0..1` 以外の数値は 0-100 スケールとして扱う。 */
const toPct = (value: number, max: number | undefined): number => {
  if (max !== undefined && max > 0) {
    return Math.min(100, Math.max(0, (value / max) * 100));
  }
  return Math.min(100, Math.max(0, value));
};

export const Score = defineComponent(
  {
    description:
      "0-100 スコアのリングゲージ。value は必須 (max で分母変更可)。label で指標名、detail で補足行。80+ 緑・50+ 黄・それ以下赤。ヘルススキャン・品質スコアの表示向け。Row/Grid に並べられる",
    schema: v.looseObject({
      detail: v.optional(v.string()),
      label: v.optional(v.string()),
      max: v.optional(NUMISH),
      value: NUMISH,
    }),
  },
  ({ value, max, label, detail }) => {
    const vNum = numOf(value) ?? 0;
    const pct = toPct(vNum, numOf(max));
    const band = bandOf(pct);
    const shown = Number.isInteger(vNum) ? String(vNum) : vNum.toFixed(1);
    return (
      <div
        className={`not-prose my-6 inline-flex items-center gap-3 rounded-lg border px-4 py-3 ${BORDER_CLS}`}
      >
        <svg className="h-14 w-14" viewBox="0 0 36 36">
          <circle
            className="stroke-neutral-200 dark:stroke-neutral-700"
            cx="18"
            cy="18"
            fill="none"
            r="15.9155"
            strokeWidth="3"
          />
          <circle
            className={STROKE_CLS[band]}
            cx="18"
            cy="18"
            fill="none"
            pathLength={100}
            r="15.9155"
            strokeDasharray={`${pct} 100`}
            strokeDashoffset="25"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <text
            className={`fill-current font-semibold ${TEXT_BAND[band]}`}
            dominantBaseline="central"
            fontSize="9"
            textAnchor="middle"
            x="18"
            y="18"
          >
            {shown}
          </text>
        </svg>
        <div className="min-w-0">
          {nonEmpty(label) ? (
            <div className={`truncate text-sm font-medium ${TEXT.strong}`}>
              {label}
            </div>
          ) : null}
          <div className={`${TEXT_SUB} ${TEXT.muted}`}>
            {nonEmpty(detail) ? detail : "score"}
          </div>
        </div>
      </div>
    );
  }
);

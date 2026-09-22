import * as v from "valibot";

import { defineComponent } from "../define.js";
import { numOf, NUMISH } from "./attrs.js";
import { Icon } from "./icon.js";
import { TEXT, TONE_TEXT } from "./tones.js";

export const DiffStat = defineComponent(
  {
    description:
      'diff 量サマリ (PR ヘッダーの "+N −M across F files")。files/adds/dels は数値。追加=緑・削除=赤の proportional バー付き。インラインでも単独でも使える',
    schema: v.looseObject({
      adds: v.optional(NUMISH, "0"),
      dels: v.optional(NUMISH, "0"),
      files: v.optional(NUMISH),
    }),
  },
  ({ files, adds, dels }) => {
    const a = Math.max(0, numOf(adds) ?? 0);
    const d = Math.max(0, numOf(dels) ?? 0);
    const f = numOf(files);
    const largest = Math.max(a, d);
    const aPct =
      largest > 0 ? (a / largest / (a / largest + d / largest)) * 100 : 50;
    return (
      <span className="not-prose mx-0.5 inline-flex items-center gap-2 align-baseline text-xs">
        {f === undefined ? null : (
          <span className={`inline-flex items-center gap-1 ${TEXT.muted}`}>
            <Icon className="h-3.5 w-3.5" name="lucide:file-diff" />
            {f} {f === 1 ? "file" : "files"}
          </span>
        )}
        <span
          className={`font-mono font-medium tabular-nums ${TONE_TEXT.emerald}`}
        >
          +{a}
        </span>
        <span className={`font-mono font-medium tabular-nums ${TONE_TEXT.red}`}>
          −{d}
        </span>
        {largest > 0 ? (
          <span
            aria-hidden
            className="inline-flex h-2 w-14 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"
          >
            <span
              className="h-full bg-emerald-500"
              style={{ width: `${aPct}%` }}
            />
            <span
              className="h-full bg-red-500"
              style={{ width: `${100 - aPct}%` }}
            />
          </span>
        ) : null}
      </span>
    );
  }
);

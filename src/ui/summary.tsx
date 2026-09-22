import * as v from "valibot";

import { defineComponent } from "../define.js";
import { NUMISH } from "./attrs.js";
import { TEXT, TRACK_CLS } from "./tones.js";

export const Summary = defineComponent(
  {
    description:
      "進捗バー。done/total は文字列でもよい (MDX の属性は文字列のため)",
    schema: v.looseObject({
      done: v.optional(NUMISH, "0"),
      label: v.optional(v.string()),
      total: v.optional(NUMISH, "0"),
    }),
  },
  ({ done, total, label }) => {
    // Unparseable values read as 0 — `NaN` would leak into the label text
    // and produce an invalid `width: NaN%` style. Negative counts are
    // clamped too: `width: -50%` is just as invalid.
    const d = Math.max(0, Number.isFinite(Number(done)) ? Number(done) : 0);
    const t = Math.max(0, Number.isFinite(Number(total)) ? Number(total) : 0);
    const pct = t > 0 ? Math.min(100, Math.round((d / t) * 100)) : 0;
    return (
      <div className="not-prose my-6">
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="font-medium">{label ?? "Progress"}</span>
          <span className={`tabular-nums ${TEXT.muted}`}>
            {d}/{t}
          </span>
        </div>
        <div className={`h-2 overflow-hidden rounded-full ${TRACK_CLS}`}>
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }
);

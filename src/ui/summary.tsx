import * as v from "valibot";

import { defineComponent } from "../define.js";

export const Summary = defineComponent(
  {
    description:
      "進捗バー。done/total は文字列でもよい (MDX の属性は文字列のため)",
    schema: v.looseObject({
      done: v.optional(v.union([v.string(), v.number()]), "0"),
      label: v.optional(v.string()),
      total: v.optional(v.union([v.string(), v.number()]), "0"),
    }),
  },
  ({ done, total, label }) => {
    const d = Number(done);
    const t = Number(total);
    const pct = t > 0 ? Math.min(100, Math.round((d / t) * 100)) : 0;
    return (
      <div className="not-prose my-4">
        <div className="mb-1 flex items-baseline justify-between text-sm">
          <span className="font-medium">{label ?? "Progress"}</span>
          <span className="text-neutral-500 tabular-nums dark:text-neutral-400">
            {d}/{t}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }
);

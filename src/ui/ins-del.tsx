import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";

/**
 * Inline word-level edits for prose/config changes — the inline counterpart
 * of Before/After blocks and ```diff fences. Renders semantic <ins>/<del>.
 */
export const Ins = defineComponent(
  {
    description:
      "挿入テキスト (インライン、緑+下線)。<Del> と対で before/after の差分を文やコード片に示す",
    schema: v.looseObject({
      title: v.optional(v.string()),
    }),
  },
  ({ title, children }) => (
    <ins
      className="rounded-[0.2rem] bg-emerald-500/15 px-0.5 py-px text-emerald-800 underline decoration-emerald-600/50 decoration-1 underline-offset-2 dark:text-emerald-300 dark:decoration-emerald-400/50"
      title={nonEmpty(title) ? title : "inserted"}
    >
      {children}
    </ins>
  )
);

export const Del = defineComponent(
  {
    description:
      "削除テキスト (インライン、赤+取り消し線)。<Ins> と対で before/after の差分を文やコード片に示す",
    schema: v.looseObject({
      title: v.optional(v.string()),
    }),
  },
  ({ title, children }) => (
    <del
      className="rounded-[0.2rem] bg-red-500/15 px-0.5 py-px text-red-800 decoration-red-500/70 decoration-1 dark:text-red-300"
      title={nonEmpty(title) ? title : "deleted"}
    >
      {children}
    </del>
  )
);

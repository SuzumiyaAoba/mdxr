import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { NUMISH } from "./attrs.js";
import { Icon } from "./icon.js";
import { BORDER_CLS, TEXT } from "./tones.js";

export const Stats = defineComponent(
  {
    description: "指標カードのグリッド。<Stat> を並べる",
  },
  ({ children }) => (
    <div className="not-prose my-6 grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
      {children}
    </div>
  )
);

const deltaStyle = (delta: string): { cls: string; icon: string } => {
  if (delta.startsWith("+")) {
    return {
      cls: "text-emerald-600 dark:text-emerald-400",
      icon: "lucide:trending-up",
    };
  }
  if (delta.startsWith("-")) {
    return {
      cls: "text-red-600 dark:text-red-400",
      icon: "lucide:trending-down",
    };
  }
  return {
    cls: TEXT.muted,
    icon: "lucide:minus",
  };
};

export const Stat = defineComponent(
  {
    description:
      '指標カード。value/label は必須。delta に "+12%" 等を書くと符号で色付く',
    schema: v.looseObject({
      delta: v.optional(v.string()),
      label: v.string(),
      value: NUMISH,
    }),
  },
  ({ value, label, delta }) => (
    <div className={`rounded-lg border p-4 ${BORDER_CLS}`}>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className={`mt-0.5 text-sm ${TEXT.muted}`}>{label}</div>
      {nonEmpty(delta) ? (
        <div
          className={`mt-1.5 flex items-center gap-1 text-xs font-medium ${deltaStyle(delta).cls}`}
        >
          <Icon className="h-3.5 w-3.5" name={deltaStyle(delta).icon} />
          {delta}
        </div>
      ) : null}
    </div>
  )
);

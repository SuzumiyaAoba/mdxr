import { differenceInCalendarDays, isValid, parseISO } from "date-fns";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { Icon } from "./icon.js";

const CLASSES = {
  neutral:
    "border-neutral-300 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-300",
  overdue:
    "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300",
  soon: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
};

const dueState = (date: string): { cls: string; rel: string | null } => {
  const d = parseISO(date);
  if (!isValid(d)) {
    return { cls: CLASSES.neutral, rel: null };
  }
  const days = differenceInCalendarDays(d, new Date());
  if (days < 0) {
    return { cls: CLASSES.overdue, rel: `${-days}d overdue` };
  }
  if (days === 0) {
    return { cls: CLASSES.soon, rel: "today" };
  }
  if (days <= 3) {
    return { cls: CLASSES.soon, rel: `in ${days}d` };
  }
  return { cls: CLASSES.neutral, rel: `in ${days}d` };
};

export const Due = defineComponent(
  {
    description:
      "期限チップ。date 属性 (ISO) から urgency を描画時点で計算する",
    schema: v.looseObject({
      date: v.string(),
      label: v.optional(v.string()),
    }),
  },
  ({ date, label }) => {
    const { cls, rel } = dueState(date);
    return (
      <span
        className={`not-prose inline-flex items-baseline gap-1 rounded-md border px-1.5 py-0.5 text-xs ${cls}`}
      >
        <Icon
          className="h-3 w-3 self-center opacity-60"
          name="lucide:calendar-days"
        />
        {nonEmpty(label) ? <span className="opacity-75">{label}</span> : null}
        <time dateTime={date} className="font-mono">
          {date}
        </time>
        {rel === null ? null : <span className="opacity-60">{rel}</span>}
      </span>
    );
  }
);

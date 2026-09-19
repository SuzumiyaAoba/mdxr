import { differenceInCalendarDays, isValid, parseISO } from "date-fns";
import { useContext } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { DocContext } from "../doc-context.js";
import { nonEmpty } from "../guards.js";
import { Icon } from "./icon.js";
import { TONE } from "./tones.js";

const CLASSES = {
  neutral: TONE.neutral,
  overdue: TONE.red,
  soon: TONE.amber,
};

const dueState = (
  date: string,
  now: Date
): { cls: string; rel: string | null } => {
  const d = parseISO(date);
  if (!isValid(d)) {
    return { cls: CLASSES.neutral, rel: null };
  }
  const days = differenceInCalendarDays(d, now);
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
    // ctx.now is the SSR timestamp replayed by the hydration bundle; the
    // fallback covers standalone use (Storybook, tests).
    const { now } = useContext(DocContext);
    const { cls, rel } = dueState(date, now ?? new Date());
    return (
      <span
        className={`not-prose inline-flex items-baseline gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
      >
        <Icon className="h-3 w-3 self-center" name="lucide:calendar-days" />
        {nonEmpty(label) ? <span className="opacity-75">{label}</span> : null}
        <time dateTime={date} className="font-mono">
          {date}
        </time>
        {rel === null ? null : <span className="opacity-60">{rel}</span>}
      </span>
    );
  }
);

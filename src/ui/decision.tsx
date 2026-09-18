import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { Pill } from "./bits.js";
import { TONE } from "./tones.js";

export const DECISION_STATUSES = [
  "accepted",
  "deprecated",
  "proposed",
  "rejected",
  "superseded",
] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

const STYLES: Record<
  DecisionStatus,
  { cls: string; icon: string; label: string }
> = {
  accepted: {
    cls: TONE.emerald,
    icon: "lucide:check",
    label: "Accepted",
  },
  deprecated: {
    cls: TONE.neutral,
    icon: "lucide:archive",
    label: "Deprecated",
  },
  proposed: {
    cls: TONE.sky,
    icon: "lucide:pen-line",
    label: "Proposed",
  },
  rejected: {
    cls: TONE.red,
    icon: "lucide:x",
    label: "Rejected",
  },
  superseded: {
    cls: TONE.amber,
    icon: "lucide:replace",
    label: "Superseded",
  },
};

export const Decision = defineComponent(
  {
    description:
      "決定記録 (ADR-lite)。status は proposed|accepted|rejected|deprecated|superseded。:::decision は軽量版の Callout",
    schema: v.looseObject({
      date: v.optional(v.string()),
      status: v.optional(v.picklist(DECISION_STATUSES), "proposed"),
      title: v.string(),
    }),
  },
  ({ title, status, date, children }) => {
    const s = STYLES[status];
    return (
      <section className="my-6 rounded-lg border border-indigo-200 bg-indigo-50/50 px-4 py-3 dark:border-indigo-900 dark:bg-indigo-950/30">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-semibold text-indigo-900 dark:text-indigo-100">
            {title}
          </span>
          <Pill className={s.cls} icon={s.icon}>
            {s.label}
          </Pill>
          {nonEmpty(date) ? (
            <time className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
              {date}
            </time>
          ) : null}
        </div>
        {children === undefined ? null : (
          <div className="mt-1.5 text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {children}
          </div>
        )}
      </section>
    );
  }
);

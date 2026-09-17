import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { Icon } from "./icon.js";

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
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    icon: "lucide:check",
    label: "Accepted",
  },
  deprecated: {
    cls: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
    icon: "lucide:archive",
    label: "Deprecated",
  },
  proposed: {
    cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
    icon: "lucide:pen-line",
    label: "Proposed",
  },
  rejected: {
    cls: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
    icon: "lucide:x",
    label: "Rejected",
  },
  superseded: {
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
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
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}
          >
            <Icon className="h-3 w-3" name={s.icon} />
            {s.label}
          </span>
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

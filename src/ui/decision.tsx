import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { Pill, TrimBody } from "./bits.js";
import { TEXT, TONE, TONE_BORDER } from "./tones.js";

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
      <section
        className={`my-6 rounded-lg border bg-indigo-50/50 px-4 py-3 dark:bg-indigo-950/30 ${TONE_BORDER.indigo}`}
      >
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-semibold text-indigo-900 dark:text-indigo-100">
            {title}
          </span>
          <Pill className={s.cls} icon={s.icon}>
            {s.label}
          </Pill>
          {nonEmpty(date) ? (
            <time className={`font-mono text-xs ${TEXT.muted}`}>{date}</time>
          ) : null}
        </div>
        <TrimBody className="mt-1.5 text-sm">{children}</TrimBody>
      </section>
    );
  }
);

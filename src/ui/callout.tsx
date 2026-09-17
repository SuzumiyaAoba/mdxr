import * as v from "valibot";

import { defineComponent } from "../define.js";
import { Icon } from "./icon.js";

export const CALLOUT_KINDS = [
  "note",
  "tip",
  "important",
  "warning",
  "caution",
  "danger",
  "decision",
  "goal",
  "nongoal",
  "question",
  "answer",
] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];

const KINDS: Record<CalloutKind, { label: string; cls: string; icon: string }> =
  {
    answer: {
      cls: "border-cyan-500 bg-cyan-50 text-cyan-950 dark:bg-cyan-950/40 dark:text-cyan-100",
      icon: "lucide:message-circle-check",
      label: "Answer",
    },
    caution: {
      cls: "border-orange-500 bg-orange-50 text-orange-950 dark:bg-orange-950/40 dark:text-orange-100",
      icon: "lucide:octagon-alert",
      label: "Caution",
    },
    danger: {
      cls: "border-red-600 bg-red-50 text-red-950 dark:bg-red-950/40 dark:text-red-100",
      icon: "lucide:octagon-x",
      label: "Danger",
    },
    decision: {
      cls: "border-indigo-500 bg-indigo-50 text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-100",
      icon: "lucide:scale",
      label: "Decision",
    },
    goal: {
      cls: "border-teal-500 bg-teal-50 text-teal-950 dark:bg-teal-950/40 dark:text-teal-100",
      icon: "lucide:target",
      label: "Goal",
    },
    important: {
      cls: "border-violet-500 bg-violet-50 text-violet-950 dark:bg-violet-950/40 dark:text-violet-100",
      icon: "lucide:message-square-warning",
      label: "Important",
    },
    nongoal: {
      cls: "border-neutral-400 bg-neutral-50 text-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-200",
      icon: "lucide:circle-slash",
      label: "Non-goal",
    },
    note: {
      cls: "border-sky-500 bg-sky-50 text-sky-950 dark:bg-sky-950/40 dark:text-sky-100",
      icon: "lucide:info",
      label: "Note",
    },
    question: {
      cls: "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-950 dark:bg-fuchsia-950/40 dark:text-fuchsia-100",
      icon: "lucide:circle-question-mark",
      label: "Question",
    },
    tip: {
      cls: "border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100",
      icon: "lucide:lightbulb",
      label: "Tip",
    },
    warning: {
      cls: "border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100",
      icon: "lucide:triangle-alert",
      label: "Warning",
    },
  };

export const Callout = defineComponent(
  {
    description:
      "強調ブロック。`:::note` / `> [!NOTE]` などの規約からも生成される",
    schema: v.looseObject({
      kind: v.optional(v.picklist(CALLOUT_KINDS), "note"),
      title: v.optional(v.string()),
    }),
  },
  ({ kind, title, children }) => {
    const k = KINDS[kind];
    return (
      <aside
        className={`my-6 rounded-r-lg border-l-4 px-4 py-3 text-sm ${k.cls}`}
      >
        <div className="flex items-center gap-1.5 font-semibold">
          <Icon className="h-4 w-4 shrink-0" name={k.icon} />
          <span>{k.label}</span>
          {title !== undefined && title !== "" ? (
            <span className="font-normal opacity-75">{title}</span>
          ) : null}
        </div>
        {children === undefined ? null : (
          <div className="mt-1.5 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {children}
          </div>
        )}
      </aside>
    );
  }
);

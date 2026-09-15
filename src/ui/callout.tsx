import * as v from "valibot";

import { defineComponent } from "../define.js";

export const CALLOUT_KINDS = [
  "note",
  "tip",
  "important",
  "warning",
  "caution",
  "danger",
  "decision",
] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];

const KINDS: Record<CalloutKind, { label: string; cls: string }> = {
  caution: {
    cls: "border-orange-500 bg-orange-50 text-orange-950 dark:bg-orange-950/40 dark:text-orange-100",
    label: "Caution",
  },
  danger: {
    cls: "border-red-600 bg-red-50 text-red-950 dark:bg-red-950/40 dark:text-red-100",
    label: "Danger",
  },
  decision: {
    cls: "border-indigo-500 bg-indigo-50 text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-100",
    label: "Decision",
  },
  important: {
    cls: "border-violet-500 bg-violet-50 text-violet-950 dark:bg-violet-950/40 dark:text-violet-100",
    label: "Important",
  },
  note: {
    cls: "border-sky-500 bg-sky-50 text-sky-950 dark:bg-sky-950/40 dark:text-sky-100",
    label: "Note",
  },
  tip: {
    cls: "border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100",
    label: "Tip",
  },
  warning: {
    cls: "border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100",
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
        className={`my-4 rounded-r-lg border-l-4 px-4 py-3 text-sm ${k.cls}`}
      >
        <div className="mb-1 flex items-baseline gap-2 font-semibold">
          <span>{k.label}</span>
          {title !== undefined && title !== "" ? (
            <span className="font-normal opacity-75">{title}</span>
          ) : null}
        </div>
        <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          {children}
        </div>
      </aside>
    );
  }
);

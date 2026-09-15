import * as v from "valibot";

import { defineComponent } from "../define.js";

export const STATUSES = ["todo", "doing", "done", "blocked"] as const;
export type Status = (typeof STATUSES)[number];

const STYLES: Record<Status, { label: string; cls: string }> = {
  blocked: {
    cls: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
    label: "Blocked",
  },
  doing: {
    cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
    label: "In progress",
  },
  done: {
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    label: "Done",
  },
  todo: {
    cls: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
    label: "Todo",
  },
};

export const StatusBadge = defineComponent(
  {
    description: "ステータスを示す小さなバッジ",
    schema: v.looseObject({
      status: v.optional(v.picklist(STATUSES), "todo"),
    }),
  },
  ({ status }) => {
    const s = STYLES[status];
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}
      >
        {s.label}
      </span>
    );
  }
);

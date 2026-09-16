import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { Icon } from "./icon.js";
import { Owner } from "./owner.js";

export const APPROVAL_STATUSES = [
  "approved",
  "changes-requested",
  "pending",
  "rejected",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

const STYLES: Record<
  ApprovalStatus,
  { cls: string; icon: string; label: string }
> = {
  approved: {
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    icon: "lucide:check",
    label: "Approved",
  },
  "changes-requested": {
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
    icon: "lucide:message-square-warning",
    label: "Changes requested",
  },
  pending: {
    cls: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
    icon: "lucide:clock",
    label: "Pending",
  },
  rejected: {
    cls: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
    icon: "lucide:x",
    label: "Rejected",
  },
};

export const Approvals = defineComponent(
  {
    description: "承認/レビュー一覧のコンテナ。<Approval> を並べる",
  },
  ({ children }) => (
    <div className="not-prose my-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {children}
    </div>
  )
);

export const Approval = defineComponent(
  {
    description:
      "承認者1行。name は必須。status は pending|approved|rejected|changes-requested",
    schema: v.looseObject({
      date: v.optional(v.string()),
      name: v.string(),
      role: v.optional(v.string()),
      status: v.optional(v.picklist(APPROVAL_STATUSES), "pending"),
    }),
  },
  ({ name, role, status, date, children }) => {
    const s = STYLES[status];
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
        <Owner name={name} role={role} />
        {children === undefined ? null : (
          <span className="min-w-0 flex-1 text-sm text-neutral-500 dark:text-neutral-400">
            {children}
          </span>
        )}
        <span className="ml-auto flex items-baseline gap-2">
          {nonEmpty(date) ? (
            <time className="font-mono text-xs text-neutral-400 dark:text-neutral-500">
              {date}
            </time>
          ) : null}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}
          >
            <Icon className="h-3 w-3" name={s.icon} />
            {s.label}
          </span>
        </span>
      </div>
    );
  }
);

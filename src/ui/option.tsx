import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { Icon } from "./icon.js";

export const OPTION_STATUSES = [
  "considered",
  "recommended",
  "rejected",
] as const;
export type OptionStatus = (typeof OPTION_STATUSES)[number];

const STYLES: Record<
  OptionStatus,
  { card: string; chip: string; icon: string; label: string }
> = {
  considered: {
    card: "border-neutral-200 dark:border-neutral-800",
    chip: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
    icon: "lucide:minus",
    label: "Considered",
  },
  recommended: {
    card: "border-emerald-300 dark:border-emerald-800",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    icon: "lucide:thumbs-up",
    label: "Recommended",
  },
  rejected: {
    card: "border-neutral-200 opacity-70 dark:border-neutral-800",
    chip: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
    icon: "lucide:thumbs-down",
    label: "Rejected",
  },
};

export const Option = defineComponent(
  {
    description:
      "検討した選択肢カード。status は recommended|considered|rejected。<Columns> と組み合わせて並べる",
    schema: v.looseObject({
      status: v.optional(v.picklist(OPTION_STATUSES), "considered"),
      title: v.optional(v.string()),
    }),
  },
  ({ title, status, children }) => {
    const s = STYLES[status];
    return (
      <div className={`my-3 rounded-lg border p-4 ${s.card}`}>
        <div className="flex flex-wrap items-center gap-2">
          {nonEmpty(title) ? (
            <span className="font-semibold">{title}</span>
          ) : null}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.chip}`}
          >
            <Icon className="h-3 w-3" name={s.icon} />
            {s.label}
          </span>
        </div>
        <div className="text-sm [&>*:first-child]:mt-2 [&>*:last-child]:mb-0">
          {children}
        </div>
      </div>
    );
  }
);

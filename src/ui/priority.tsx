import * as v from "valibot";

import { defineComponent } from "../define.js";
import { Icon } from "./icon.js";

export const PRIORITY_LEVELS = ["p0", "p1", "p2", "p3"] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

const STYLES: Record<PriorityLevel, { cls: string; label: string }> = {
  p0: {
    cls: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
    label: "P0",
  },
  p1: {
    cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300",
    label: "P1",
  },
  p2: {
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
    label: "P2",
  },
  p3: {
    cls: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
    label: "P3",
  },
};

export const Priority = defineComponent(
  {
    description:
      "優先度ピル。level は p0|p1|p2|p3。children を付けると補足表示になる",
    schema: v.looseObject({
      level: v.optional(v.picklist(PRIORITY_LEVELS), "p2"),
    }),
  },
  ({ level, children }) => {
    const s = STYLES[level];
    return (
      <span
        className={`not-prose inline-flex items-baseline gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}
      >
        <Icon className="h-3 w-3 self-center" name="lucide:flag" />
        {s.label}
        {children === undefined || children === "" ? null : (
          <span className="font-normal">{children}</span>
        )}
      </span>
    );
  }
);

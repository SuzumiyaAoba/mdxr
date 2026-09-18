import type { ReactNode, ReactElement } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { Icon } from "./icon.js";
import { TRIM_CLS } from "./tones.js";

const panel = (
  cls: { border: string; head: string },
  icon: string,
  label: string,
  title: string | undefined,
  children: ReactNode
): ReactElement => (
  <div className={`overflow-hidden rounded-lg border ${cls.border}`}>
    <div
      className={`flex items-center gap-1.5 border-b px-4 py-2 text-xs font-semibold ${cls.head}`}
    >
      <Icon className="h-3.5 w-3.5" name={icon} />
      {title ?? label}
    </div>
    <div className={`px-4 py-2.5 ${TRIM_CLS}`}>{children}</div>
  </div>
);

/**
 * Before/After panels — wrap in `<Columns>` for side-by-side layout.
 * `title` overrides the label (e.g. "Current" / "Proposed").
 */
export const Before = defineComponent(
  {
    description:
      "Before パネル (赤系)。<Columns> と組み合わせて before/after 比較に。title でラベル上書き可",
    schema: v.looseObject({
      title: v.optional(v.string()),
    }),
  },
  ({ title, children }) =>
    panel(
      {
        border: "border-red-200 dark:border-red-900/60",
        head: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
      },
      "lucide:history",
      "Before",
      title,
      children
    )
);

export const After = defineComponent(
  {
    description:
      "After パネル (緑系)。<Columns> と組み合わせて before/after 比較に。title でラベル上書き可",
    schema: v.looseObject({
      title: v.optional(v.string()),
    }),
  },
  ({ title, children }) =>
    panel(
      {
        border: "border-emerald-200 dark:border-emerald-900/60",
        head: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
      },
      "lucide:sparkles",
      "After",
      title,
      children
    )
);

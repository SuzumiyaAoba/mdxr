import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { TEXT } from "./tones.js";

const initials = (name: string): string => {
  const clean = name.replace(/^@+/u, "").trim();
  const parts = clean.split(/[\s._-]+/u).filter(Boolean);
  const chars =
    parts.length > 0
      ? parts.slice(0, 2).map((w) => w.charAt(0))
      : [clean.charAt(0)];
  return chars.join("").toUpperCase();
};

export const Owner = defineComponent(
  {
    description: "担当者チップ。name は必須、role で役割を添えられる",
    schema: v.looseObject({
      name: v.string(),
      role: v.optional(v.string()),
    }),
  },
  ({ name, role }) => (
    <span className="not-prose inline-flex items-center gap-1.5 rounded-full bg-neutral-100 py-0.5 pr-2 pl-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
      <span
        className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-neutral-300 text-[9px] font-semibold text-neutral-700 dark:bg-neutral-600 dark:text-neutral-100"
        aria-hidden
      >
        {initials(name)}
      </span>
      <span className="font-medium">{name}</span>
      {nonEmpty(role) ? <span className={TEXT.faint}>{role}</span> : null}
    </span>
  )
);

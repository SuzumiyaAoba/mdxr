import * as v from "valibot";

import { defineComponent } from "../define.js";
import { Pill } from "./bits.js";
import { TONE } from "./tones.js";

export const STATUSES = ["todo", "doing", "done", "blocked"] as const;
export type Status = (typeof STATUSES)[number];

export const isStatus = (x: unknown): x is Status =>
  typeof x === "string" && (STATUSES as readonly string[]).includes(x);

/** Iconify names for each status — shared by StatusBadge, Step and Event. */
export const STATUS_ICONS: Record<Status, string> = {
  blocked: "lucide:circle-x",
  doing: "lucide:loader-circle",
  done: "lucide:circle-check",
  todo: "lucide:circle",
};

/** `text-*` color for status icons used standalone (Step, Event, Graph nodes). */
export const STATUS_ICON_CLS: Record<Status, string> = {
  blocked: "text-red-500",
  doing: "text-sky-500",
  done: "text-emerald-500",
  todo: "text-neutral-400",
};

const STYLES: Record<Status, { label: string; cls: string }> = {
  blocked: {
    cls: TONE.red,
    label: "Blocked",
  },
  doing: {
    cls: TONE.sky,
    label: "In progress",
  },
  done: {
    cls: TONE.emerald,
    label: "Done",
  },
  todo: {
    cls: TONE.neutral,
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
      <Pill className={s.cls} icon={STATUS_ICONS[status]}>
        {s.label}
      </Pill>
    );
  }
);

import * as v from "valibot";

import { defineComponent } from "../define.js";
import { isOneOf } from "../guards.js";
import { Pill } from "./bits.js";
import { TONE, TONE_TEXT } from "./tones.js";

export const STATUSES = ["todo", "doing", "done", "blocked"] as const;
export type Status = (typeof STATUSES)[number];

export const isStatus = isOneOf(STATUSES);

/** Schema entry for an optional `status` prop — shared by every task/status component. */
export const STATUS_PROP = v.optional(v.picklist(STATUSES));

/** Iconify names for each status — shared by StatusBadge, Step and Event. */
export const STATUS_ICONS: Record<Status, string> = {
  blocked: "lucide:circle-x",
  doing: "lucide:loader-circle",
  done: "lucide:circle-check",
  todo: "lucide:circle",
};

/** `text-*` color for status icons used standalone (Step, Event, Graph nodes). */
export const STATUS_ICON_CLS: Record<Status, string> = {
  blocked: TONE_TEXT.red,
  doing: TONE_TEXT.sky,
  done: TONE_TEXT.emerald,
  todo: TONE_TEXT.neutral,
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

import * as v from "valibot";

import { defineComponent } from "../define.js";
import { STATUSES } from "./status-badge.js";
import type { Status } from "./status-badge.js";

const ICONS: Record<Status, string> = {
  blocked:
    "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm5 13.6L15.6 17 12 13.4 8.4 17 7 15.6 10.6 12 7 8.4 8.4 7 12 10.6 15.6 7 17 8.4 13.4 12z",
  doing: "M12 2a10 10 0 1 0 10 10h-2a8 8 0 1 1-8-8z",
  done: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z",
  todo: "M12 4a8 8 0 1 0 8 8h2A10 10 0 1 1 12 2z",
};

const ICON_CLS: Record<Status, string> = {
  blocked: "text-red-500",
  doing: "text-sky-500",
  done: "text-emerald-500",
  todo: "text-neutral-400",
};

export const Steps = defineComponent(
  { description: "手順リストのコンテナ。<Step> を並べる" },
  ({ children }) => <div className="my-4 space-y-3">{children}</div>
);

export const Step = defineComponent(
  {
    description: "単一の手順。status は todo|doing|done|blocked",
    schema: v.looseObject({
      status: v.optional(v.picklist(STATUSES), "todo"),
    }),
  },
  ({ status, children }) => {
    const s = status;
    return (
      <div className="flex gap-3">
        <svg
          viewBox="0 0 24 24"
          className={`mt-1 h-4.5 w-4.5 shrink-0 ${ICON_CLS[s]}`}
          fill="currentColor"
          aria-label={s}
        >
          <path d={ICONS[s]} />
        </svg>
        <div className="min-w-0 flex-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          {children}
        </div>
      </div>
    );
  }
);

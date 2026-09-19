import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { TITLE_PROP } from "./attrs.js";
import { Section } from "./bits.js";
import { Icon } from "./icon.js";
import {
  STATUS_ICON_CLS,
  STATUS_ICONS,
  STATUS_PROP,
  StatusBadge,
} from "./status-badge.js";
import { TEXT } from "./tones.js";

export const Timeline = defineComponent(
  {
    description: "時系列のイベント/マイルストーンリスト。<Event> を並べる",
    schema: v.looseObject(TITLE_PROP),
  },
  ({ title, children }) => (
    <Section title={title}>
      <div className="space-y-4 border-l-2 border-neutral-300 pl-4 dark:border-neutral-700">
        {children}
      </div>
    </Section>
  )
);

export const Event = defineComponent(
  {
    description:
      "タイムラインの1項目。date は必須、status は todo|doing|done|blocked",
    schema: v.looseObject({
      date: v.string(),
      status: STATUS_PROP,
      title: v.optional(v.string()),
    }),
  },
  ({ date, status, title, children }) => (
    <div className="relative">
      {status === undefined ? (
        <span
          className="absolute top-1.5 -left-[1.42rem] h-2.5 w-2.5 rounded-full bg-neutral-400 dark:bg-neutral-500"
          aria-hidden
        />
      ) : (
        <Icon
          className={`bg-background absolute top-0.5 -left-[1.61rem] h-4 w-4 ${STATUS_ICON_CLS[status]}`}
          name={STATUS_ICONS[status]}
        />
      )}
      <div className="flex flex-wrap items-baseline gap-2">
        <time className={`font-mono text-xs ${TEXT.muted}`}>{date}</time>
        {status === undefined ? null : <StatusBadge status={status} />}
        {nonEmpty(title) ? <span className="font-medium">{title}</span> : null}
      </div>
      {children === undefined ? null : (
        <div className="text-sm [&>*:first-child]:mt-1.5 [&>*:last-child]:mb-0">
          {children}
        </div>
      )}
    </div>
  )
);

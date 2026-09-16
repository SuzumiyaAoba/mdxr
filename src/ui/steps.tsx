import { isValidElement } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { isRecord, nonEmpty } from "../guards.js";
import { Due } from "./due.js";
import { EFFORT_SIZES, Effort } from "./effort.js";
import { Icon } from "./icon.js";
import { Owner } from "./owner.js";
import { PRIORITY_LEVELS, Priority } from "./priority.js";
import { isStatus, STATUS_ICONS, STATUSES } from "./status-badge.js";
import type { Status } from "./status-badge.js";
import { Summary } from "./summary.js";

const ICON_CLS: Record<Status, string> = {
  blocked: "text-red-500",
  doing: "text-sky-500",
  done: "text-emerald-500",
  todo: "text-neutral-400",
};

export const Step = defineComponent(
  {
    description:
      "単一の手順。status は todo|doing|done|blocked。owner/effort/priority/due でチップを付けられる",
    schema: v.looseObject({
      due: v.optional(v.string()),
      effort: v.optional(v.picklist(EFFORT_SIZES)),
      owner: v.optional(v.string()),
      priority: v.optional(v.picklist(PRIORITY_LEVELS)),
      status: v.optional(v.picklist(STATUSES), "todo"),
    }),
  },
  ({ status, owner, effort, priority, due, children }) => {
    const hasChips =
      priority !== undefined ||
      effort !== undefined ||
      nonEmpty(owner) ||
      nonEmpty(due);
    return (
      <div className="flex gap-3">
        <Icon
          className={`mt-1 h-4.5 w-4.5 shrink-0 ${ICON_CLS[status]}`}
          label={status}
          name={STATUS_ICONS[status]}
        />
        <div className="min-w-0 flex-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          {children}
          {hasChips ? (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {priority === undefined ? null : <Priority level={priority} />}
              {effort === undefined ? null : <Effort size={effort} />}
              {nonEmpty(owner) ? <Owner name={owner} /> : null}
              {nonEmpty(due) ? <Due date={due} /> : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
);

/** Resolve a child's effective status — only `<Step>` elements count. */
const stepStatus = (node: unknown): Status | undefined => {
  if (!isValidElement(node) || node.type !== Step) {
    return undefined;
  }
  const s = isRecord(node.props) ? node.props.status : undefined;
  return isStatus(s) ? s : "todo";
};

export const Steps = defineComponent(
  {
    description:
      "手順リストのコンテナ。<Step> を並べる。progress で自動進捗バーを表示",
    schema: v.looseObject({
      progress: v.optional(v.union([v.boolean(), v.string()])),
    }),
  },
  ({ progress, children }) => {
    const show = progress === true || progress === "true" || progress === "";
    const items = flattenChildren(children)
      .map((node) => stepStatus(node))
      .filter((s): s is Status => s !== undefined);
    const done = items.filter((s) => s === "done").length;
    return (
      <div className="my-4 space-y-3">
        {show && items.length > 0 ? (
          <Summary done={done} label="Steps" total={items.length} />
        ) : null}
        {children}
      </div>
    );
  }
);

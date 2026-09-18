import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { nonEmpty } from "../guards.js";
import { isEl } from "./children.js";
import { Due } from "./due.js";
import { EFFORT_SIZES, Effort } from "./effort.js";
import { Icon } from "./icon.js";
import { Owner } from "./owner.js";
import { PRIORITY_LEVELS, Priority } from "./priority.js";
import { STATUSES } from "./status-badge.js";
import type { Status } from "./status-badge.js";

const DOT: Record<Status, string> = {
  blocked: "bg-red-500",
  doing: "bg-sky-500",
  done: "bg-emerald-500",
  todo: "bg-neutral-400",
};

const CARD_STATUS: Record<Status, { cls: string; icon: string }> = {
  blocked: { cls: "text-red-500", icon: "lucide:circle-x" },
  doing: { cls: "text-sky-500", icon: "lucide:loader-circle" },
  done: { cls: "text-emerald-500", icon: "lucide:circle-check" },
  todo: { cls: "text-neutral-400", icon: "lucide:circle" },
};

export const BoardCard = defineComponent(
  {
    description:
      "カンバンのカード。title は必須。priority/effort/owner/due で既存チップを並べられる。children は補足テキスト",
    schema: v.looseObject({
      due: v.optional(v.string()),
      effort: v.optional(v.picklist(EFFORT_SIZES)),
      owner: v.optional(v.string()),
      priority: v.optional(v.picklist(PRIORITY_LEVELS)),
      status: v.optional(v.picklist(STATUSES)),
      title: v.string(),
    }),
  },
  ({ title, priority, effort, owner, due, status, children }) => {
    const hasChips =
      priority !== undefined ||
      effort !== undefined ||
      nonEmpty(owner) ||
      nonEmpty(due) ||
      status !== undefined;
    return (
      <div className="rounded-md border border-neutral-200 bg-white p-2.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-start gap-1.5">
          {status === undefined ? null : (
            <Icon
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${CARD_STATUS[status].cls}`}
              label={status}
              name={CARD_STATUS[status].icon}
            />
          )}
          <div className="min-w-0 flex-1 text-sm leading-snug font-medium">
            {title}
          </div>
        </div>
        {children === undefined ? null : (
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {children}
          </div>
        )}
        {hasChips ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {priority === undefined ? null : <Priority level={priority} />}
            {effort === undefined ? null : <Effort size={effort} />}
            {nonEmpty(owner) ? <Owner name={owner} /> : null}
            {nonEmpty(due) ? <Due date={due} /> : null}
          </div>
        ) : null}
      </div>
    );
  }
);

export const Lane = defineComponent(
  {
    description:
      "カンバンの列。<Board> の子として使う。title は列名、status でヘッダの色点 (todo|doing|done|blocked)。子の <BoardCard> 数がバッジになる",
    schema: v.looseObject({
      status: v.optional(v.picklist(STATUSES)),
      title: v.string(),
    }),
  },
  ({ title, status, children }) => {
    const count = flattenChildren(children).filter((c) =>
      isEl(c, BoardCard)
    ).length;
    return (
      <section className="w-64 shrink-0 rounded-xl bg-neutral-100/70 p-2 dark:bg-neutral-900/70">
        <header className="flex items-center gap-2 px-1.5 py-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
          {status === undefined ? null : (
            <span
              aria-hidden
              className={`h-2 w-2 shrink-0 rounded-full ${DOT[status]}`}
            />
          )}
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {count > 0 ? (
            <span className="rounded-full bg-neutral-200/80 px-1.5 py-px font-mono text-[0.65rem] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
              {count}
            </span>
          ) : null}
        </header>
        <div className="space-y-2">{children}</div>
      </section>
    );
  }
);

export const Board = defineComponent(
  {
    description:
      "カンバンボードのコンテナ。<Lane> を横に並べる (はみ出しは横スクロール)",
    schema: v.looseObject({
      title: v.optional(v.string()),
    }),
  },
  ({ title, children }) => (
    <section className="my-6">
      {nonEmpty(title) ? <h3 className="mt-0">{title}</h3> : null}
      <div className="not-prose flex items-start gap-3 overflow-x-auto pb-1">
        {children}
      </div>
    </section>
  )
);

import type { ReactElement } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren, textOf } from "../define.js";
import { nonEmpty } from "../guards.js";
import { TITLE_PROP } from "./attrs.js";
import { ACTION_BUTTON_CLS, CopyFeedback, Section, TrimBody } from "./bits.js";
import { isEl } from "./children.js";
import { CHIP_PROPS, ChipRow } from "./chips.js";
import { Icon } from "./icon.js";
import { STATUS_ICON_CLS, STATUS_ICONS, STATUS_PROP } from "./status-badge.js";
import type { Status } from "./status-badge.js";
import { BORDER_CLS, COUNT_CHIP_CLS, TEXT } from "./tones.js";

const DOT: Record<Status, string> = {
  blocked: "bg-red-500",
  doing: "bg-sky-500",
  done: "bg-emerald-500",
  todo: "bg-neutral-400",
};

/**
 * Lane-to-lane move buttons — the keyboard/touch alternative to drag & drop
 * (HTML5 DnD never reaches touch browsers). `data-board-move` is a client-JS
 * hook: doc-events.ts moves the card ±1 lane on click and disables the
 * button at the board's edges via `disabled`.
 */
const MoveButton = (props: {
  /** `"-1"` previous lane, `"1"` next lane. */
  dir: "-1" | "1";
}): ReactElement => (
  <button
    aria-label={
      props.dir === "-1" ? "Move to previous lane" : "Move to next lane"
    }
    className="mdxr-move"
    data-board-move={props.dir}
    title={props.dir === "-1" ? "Move left" : "Move right"}
    type="button"
  >
    <Icon
      className="h-3.5 w-3.5"
      name={props.dir === "-1" ? "lucide:chevron-left" : "lucide:chevron-right"}
    />
  </button>
);

export const BoardCard = defineComponent(
  {
    description:
      "カンバンのカード。title は必須。priority/effort/owner/due で既存チップを並べられる。children は補足テキスト。ドラッグまたは両端の矢印ボタンでレーン間を移動できる",
    schema: v.looseObject({
      ...CHIP_PROPS,
      status: STATUS_PROP,
      title: v.string(),
    }),
  },
  ({ title, priority, effort, owner, due, status, children }) => {
    // Plain-text payload for the markdown serializer — element children
    // (links, emphasis) flatten to their visible text.
    const text = children === undefined ? "" : textOf(children).trim();
    return (
      <div
        className={`rounded-md border bg-white p-2.5 shadow-sm dark:bg-neutral-950 ${BORDER_CLS}`}
        data-board-card=""
        data-card-due={due}
        data-card-effort={effort}
        data-card-owner={owner}
        data-card-priority={priority}
        data-card-status={status}
        data-card-text={nonEmpty(text) ? text : undefined}
        data-card-title={title}
        draggable
      >
        <div className="flex items-start gap-1.5">
          <Icon
            className={`mdxr-grip mt-0.5 h-3.5 w-3.5 shrink-0 ${TEXT.ghost}`}
            name="lucide:grip-vertical"
          />
          {status === undefined ? null : (
            <Icon
              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${STATUS_ICON_CLS[status]}`}
              label={status}
              name={STATUS_ICONS[status]}
            />
          )}
          <div className="min-w-0 flex-1 text-sm leading-snug font-medium">
            {title}
          </div>
          <span className="mdxr-card-moves -mt-0.5 -mr-1 flex shrink-0 items-center">
            <MoveButton dir="-1" />
            <MoveButton dir="1" />
          </span>
        </div>
        <TrimBody className={`mt-1 text-xs ${TEXT.muted}`}>{children}</TrimBody>
        <ChipRow due={due} effort={effort} owner={owner} priority={priority} />
      </div>
    );
  }
);

export const Lane = defineComponent(
  {
    description:
      "カンバンの列。<Board> の子として使う。title は列名、status でヘッダの色点 (todo|doing|done|blocked)。子の <BoardCard> 数がバッジになる。空の列もドロップ先になる",
    schema: v.looseObject({
      status: STATUS_PROP,
      title: v.string(),
    }),
  },
  ({ title, status, children }) => {
    const count = flattenChildren(children).filter((c) =>
      isEl(c, BoardCard)
    ).length;
    return (
      <section
        className="w-64 shrink-0 rounded-xl bg-neutral-100/70 p-2 dark:bg-neutral-900/70"
        data-board-lane=""
        data-lane-status={status}
        data-lane-title={title}
      >
        <header
          className={`flex items-center gap-2 px-1.5 py-1.5 text-xs font-semibold ${TEXT.body}`}
        >
          {status === undefined ? null : (
            <span
              aria-hidden
              className={`h-2 w-2 shrink-0 rounded-full ${DOT[status]}`}
            />
          )}
          <span className="min-w-0 flex-1 truncate">{title}</span>
          <span className={`mdxr-lane-count ${COUNT_CHIP_CLS}`}>{count}</span>
        </header>
        <div className="min-h-8 space-y-2" data-board-cards="">
          {children}
        </div>
      </section>
    );
  }
);

export const Board = defineComponent(
  {
    description:
      "カンバンボードのコンテナ。<Lane> を横に並べる (はみ出しは横スクロール)。カードはドラッグまたは矢印ボタンで移動でき、移動後の状態を <Board> マークアップとしてコピーできる",
    schema: v.looseObject(TITLE_PROP),
  },
  ({ title, children }) => (
    <Section title={title}>
      <div className="mdxr-board" data-board="" data-board-title={title}>
        <div className="not-prose flex items-start gap-3 overflow-x-auto pb-1">
          {children}
        </div>
        <div className="mdxr-board-tools not-prose mt-2 flex items-center justify-between gap-3">
          <span className={`text-xs ${TEXT.faint}`}>
            Drag cards or use the arrow buttons, then copy the updated markup.
          </span>
          <button
            className={ACTION_BUTTON_CLS}
            data-board-copy=""
            type="button"
          >
            <CopyFeedback
              done="Copied"
              icon="lucide:clipboard-list"
              label="Copy markdown"
            />
          </button>
        </div>
      </div>
    </Section>
  )
);

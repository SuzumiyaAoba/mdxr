import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { FILE_LINK_PROPS } from "./attrs.js";
import { CaptionBar } from "./bits.js";
import { indexChildren, useChildIndex } from "./child-index.js";
import { linkTarget, useFileLink } from "./file-link.js";
import { Icon } from "./icon.js";

export const FRAME_KINDS = ["app", "lib"] as const;
export type FrameKind = (typeof FRAME_KINDS)[number];

export const Trace = defineComponent(
  {
    description:
      "スタックトレースのコンテナ。<TraceFrame> を先頭（最新フレーム）から順に並べる。error で例外メッセージ行を先頭に表示、title でキャプションバー",
    schema: v.looseObject({
      error: v.optional(v.string()),
      title: v.optional(v.string()),
    }),
  },
  ({ error, title, children }) => (
    <figure className="not-prose my-6 divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {nonEmpty(title) ? (
        <CaptionBar border={false} className="font-medium">
          {title}
        </CaptionBar>
      ) : null}
      {nonEmpty(error) ? (
        <div className="flex items-center gap-2 bg-red-50 px-4 py-2 font-mono text-[0.85em] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <Icon className="h-3.5 w-3.5 shrink-0" name="lucide:circle-alert" />
          {error}
        </div>
      ) : null}
      {indexChildren(children)}
    </figure>
  )
);

export const TraceFrame = defineComponent(
  {
    description:
      "スタックフレーム1行。#番号はコンテナ内で自動採番（先頭=#0）。name=シンボル名、path/lines=発生箇所（実在すればエディタリンク、href で上書き可）、kind=app|lib（lib は淡色+タグ）。children は注記",
    schema: v.looseObject({
      ...FILE_LINK_PROPS,
      kind: v.optional(v.picklist(FRAME_KINDS), "app"),
      name: v.string(),
    }),
  },
  ({ name, path, lines, kind, href, children }) => {
    const { n } = useChildIndex();
    const lib = kind === "lib";
    const link = useFileLink(path, lines, href);
    const loc = (
      <>
        {path}
        {nonEmpty(lines) ? `:${lines}` : ""}
      </>
    );
    const locCls = "font-mono text-xs text-neutral-400 dark:text-neutral-500";
    const locEl =
      link === undefined ? (
        <span className={locCls}>{loc}</span>
      ) : (
        <a
          className={`${locCls} no-underline hover:underline`}
          href={link}
          {...linkTarget(link)}
        >
          {loc}
        </a>
      );
    return (
      <div
        className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 ${lib ? "opacity-60" : ""}`}
      >
        <span className="w-7 shrink-0 font-mono text-xs text-neutral-400 dark:text-neutral-500">
          {n > 0 ? `#${n - 1}` : "·"}
        </span>
        <code className="font-mono text-[0.85em] text-neutral-800 dark:text-neutral-200">
          {name}
        </code>
        {nonEmpty(path) ? locEl : null}
        {lib ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-neutral-400 dark:text-neutral-500">
            <Icon className="h-3 w-3" name="lucide:package" />
            lib
          </span>
        ) : null}
        {children === undefined ? null : (
          <span className="min-w-0 flex-1 text-sm text-neutral-500 dark:text-neutral-400">
            {children}
          </span>
        )}
      </div>
    );
  }
);

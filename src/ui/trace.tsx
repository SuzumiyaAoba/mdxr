import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { FILE_LINK_PROPS } from "./attrs.js";
import { ListPanel, ListRow, LocLink, RowNote, Tag } from "./bits.js";
import { indexChildren, useChildIndex } from "./child-index.js";
import { Icon } from "./icon.js";
import { LOC_CLS, MONO_CLS, TEXT, TONE_BAND } from "./tones.js";

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
    <ListPanel title={title}>
      {nonEmpty(error) ? (
        <div
          className={`flex items-center gap-2 px-4 py-2 font-mono text-[0.85em] font-medium ${TONE_BAND.red}`}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" name="lucide:circle-alert" />
          {error}
        </div>
      ) : null}
      {indexChildren(children)}
    </ListPanel>
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
    return (
      <ListRow className={lib ? "opacity-60" : ""}>
        <span className={`${LOC_CLS} w-7 shrink-0`}>
          {n > 0 ? `#${n - 1}` : "·"}
        </span>
        <code className={MONO_CLS}>{name}</code>
        {nonEmpty(path) ? (
          <LocLink href={href} lines={lines} path={path} />
        ) : null}
        {lib ? (
          <Tag className={TEXT.faint} icon="lucide:package">
            lib
          </Tag>
        ) : null}
        <RowNote>{children}</RowNote>
      </ListRow>
    );
  }
);

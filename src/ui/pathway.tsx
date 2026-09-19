import type { ReactElement } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { nonEmpty } from "../guards.js";
import { attrTrue, BOOLISH_PROP } from "./attrs.js";
import { CaptionBar, Panel } from "./bits.js";
import { isEl } from "./children.js";
import { Icon } from "./icon.js";
import {
  isStatus,
  STATUS_ICON_CLS,
  STATUS_ICONS,
  STATUS_PROP,
} from "./status-badge.js";
import {
  CAPTION_TITLE_CLS,
  RAIL_BG_CLS,
  TEXT,
  TEXT_SUB,
  TRIM_CLS,
} from "./tones.js";

export const Stop = defineComponent(
  {
    description:
      "経路ステップ1点。label は必須 (バージョン・環境名など)、status は todo|doing|done|blocked、note で補足 (codemod・レビュー待ちなど)、current で現在地マーク。children は説明文",
    schema: v.looseObject({
      current: BOOLISH_PROP,
      label: v.string(),
      note: v.optional(v.string()),
      status: STATUS_PROP,
    }),
  },
  // Rendered by Pathway — standalone use falls back to a chip row.
  ({ label, note, status, current, children }) => {
    const st = isStatus(status) ? status : "todo";
    return (
      <div className="flex w-28 shrink-0 flex-col items-center gap-1 px-1 text-center">
        <Icon
          className={`h-5 w-5 ${STATUS_ICON_CLS[st]} ${attrTrue(current) ? "rounded-full ring-2 ring-sky-400/60" : ""}`}
          label={st}
          name={STATUS_ICONS[st]}
        />
        <span className="font-mono text-xs font-semibold">{label}</span>
        {nonEmpty(note) ? (
          <span className={`${TEXT_SUB} ${TEXT.faint}`}>{note}</span>
        ) : null}
        {children === undefined ? null : (
          <span className={`${TEXT_SUB} ${TEXT.muted} ${TRIM_CLS}`}>
            {children}
          </span>
        )}
      </div>
    );
  }
);

export const Pathway = defineComponent(
  {
    description:
      "経路ステッパー (バージョンパス v17→v18→v19、環境昇格 dev→staging→prod、段階ロールアウト)。<Stop> をコネクタ線付きで横に並べる。title はキャプション",
    schema: v.looseObject({
      title: v.optional(v.string()),
    }),
  },
  ({ title, children }): ReactElement => {
    const stops = flattenChildren(children);
    return (
      <Panel>
        {nonEmpty(title) ? (
          <CaptionBar className={CAPTION_TITLE_CLS}>
            <Icon className="h-3.5 w-3.5" name="lucide:milestone" />
            {title}
          </CaptionBar>
        ) : null}
        <div className="flex items-start gap-x-1 overflow-x-auto px-4 py-4">
          {stops.map((stop, i) => (
            <div
              className="flex flex-1 items-start last:flex-none"
              key={isEl(stop, Stop) ? (stop.key ?? i) : i}
            >
              {stop}
              {i < stops.length - 1 ? (
                <div
                  aria-hidden
                  className={`mt-2.5 h-0.5 min-w-4 flex-1 rounded-full ${RAIL_BG_CLS}`}
                />
              ) : null}
            </div>
          ))}
        </div>
      </Panel>
    );
  }
);

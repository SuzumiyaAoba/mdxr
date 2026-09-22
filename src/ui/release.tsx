import type { ReactElement, ReactNode } from "react";
import { Fragment } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { isOneOf, nonEmpty, safeHref } from "../guards.js";
import { CaptionBar, Panel } from "./bits.js";
import { isEl, propOf } from "./children.js";
import { Icon } from "./icon.js";
import {
  CAPTION_TITLE_CLS,
  MONO_CLS,
  TEXT,
  TEXT_SUB,
  TONE_TEXT,
  TRIM_CLS,
} from "./tones.js";

export const ENTRY_KINDS = [
  "breaking",
  "added",
  "changed",
  "deprecated",
  "removed",
  "fixed",
  "security",
] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

const isEntryKind = isOneOf(ENTRY_KINDS);

const ENTRY_STYLES: Record<
  EntryKind,
  { icon: string; label: string; text: string }
> = {
  added: {
    icon: "lucide:plus",
    label: "Added",
    text: TONE_TEXT.emerald,
  },
  breaking: {
    icon: "lucide:zap",
    label: "Breaking",
    text: TONE_TEXT.orange,
  },
  changed: {
    icon: "lucide:pen-line",
    label: "Changed",
    text: TONE_TEXT.sky,
  },
  deprecated: {
    icon: "lucide:archive",
    label: "Deprecated",
    text: TONE_TEXT.amber,
  },
  fixed: {
    icon: "lucide:wrench",
    label: "Fixed",
    text: TONE_TEXT.teal,
  },
  removed: {
    icon: "lucide:minus",
    label: "Removed",
    text: TONE_TEXT.red,
  },
  security: {
    icon: "lucide:shield",
    label: "Security",
    text: TONE_TEXT.violet,
  },
};

export const Entry = defineComponent(
  {
    description:
      "リリースノート項目1行。kind は breaking|added|changed|deprecated|removed|fixed|security、scope で対象スコープチップ。children は項目文",
    schema: v.looseObject({
      kind: v.optional(v.picklist(ENTRY_KINDS), "changed"),
      scope: v.optional(v.string()),
    }),
  },
  ({ kind, scope, children }) => {
    const s = ENTRY_STYLES[kind];
    return (
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-4 py-1.5">
        <Icon
          className={`h-3.5 w-3.5 shrink-0 self-center ${s.text}`}
          name={s.icon}
        />
        {nonEmpty(scope) ? (
          <code className={`${MONO_CLS} ${TEXT.faint}`}>{scope}:</code>
        ) : null}
        <span className={`min-w-0 flex-1 text-sm ${TRIM_CLS}`}>{children}</span>
      </div>
    );
  }
);

export const Release = defineComponent(
  {
    description:
      "リリースノート/CHANGELOG ブロック。version は必須、date/href (比較リンク) をヘッダに表示。<Entry> を kind 別グループに自動整列。リリース報告・変更履歴ドキュメント向け",
    schema: v.looseObject({
      date: v.optional(v.string()),
      href: v.optional(v.string()),
      title: v.optional(v.string()),
      version: v.string(),
    }),
  },
  ({ version, date, href, title, children }): ReactElement => {
    const link = safeHref(href);
    const groups = new Map<EntryKind, ReactNode[]>();
    const rest: ReactNode[] = [];
    for (const node of flattenChildren(children)) {
      if (!isEl(node, Entry)) {
        rest.push(node);
        continue;
      }
      const k = propOf(node, "kind");
      const kind = isEntryKind(k) ? k : "changed";
      const group = groups.get(kind);
      if (group === undefined) {
        groups.set(kind, [node]);
      } else {
        group.push(node);
      }
    }
    return (
      <Panel>
        <CaptionBar className={CAPTION_TITLE_CLS}>
          <Icon className="h-3.5 w-3.5" name="lucide:tag" />
          <code className={`font-mono font-semibold ${TEXT.code}`}>
            {nonEmpty(title) ? `${title} ` : ""}
            {version}
          </code>
          <span className="ml-auto flex items-center gap-x-2 font-normal">
            {nonEmpty(date) ? (
              <span className={`${TEXT_SUB} ${TEXT.faint}`}>{date}</span>
            ) : null}
            {link === undefined ? null : (
              <a
                className={`${TEXT_SUB} ${TEXT.muted} no-underline hover:underline`}
                href={link}
                rel="noopener noreferrer"
                target="_blank"
              >
                compare
              </a>
            )}
          </span>
        </CaptionBar>
        <div className="py-2">
          {ENTRY_KINDS.map((kind) => {
            const items = groups.get(kind);
            if (items === undefined || items.length === 0) {
              return null;
            }
            const s = ENTRY_STYLES[kind];
            return (
              <div className="py-1" key={kind}>
                <div
                  className={`px-4 py-1 text-xs font-semibold tracking-wide uppercase ${TEXT.muted}`}
                >
                  {s.label}
                  <span className={`ml-1.5 font-normal ${TEXT.faint}`}>
                    {items.length}
                  </span>
                </div>
                {items.map((node, i) => (
                  // Entries arrive unkeyed from the doc — group position is
                  // stable, so index keys on a fragment are safe here.
                  <Fragment key={i}>{node}</Fragment>
                ))}
              </div>
            );
          })}
          {rest.length > 0 ? (
            <div className={`px-4 py-2 ${TRIM_CLS}`}>{rest}</div>
          ) : null}
        </div>
      </Panel>
    );
  }
);

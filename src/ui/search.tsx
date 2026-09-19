import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { nonEmpty } from "../guards.js";
import { NUMISH, TITLE_PROP } from "./attrs.js";
import { ListPanel, ListRow, Pill, RowIcon, RowNote } from "./bits.js";
import { isEl, propOf } from "./children.js";
import {
  LOC_CLS,
  MONO_CLS,
  MONO_TAG_CLS,
  SURFACE_CLS,
  TEXT,
  TONE,
} from "./tones.js";

interface HitsBadge {
  label: string;
  n: number | undefined;
}

/** "0" → "no hits"; "12" → "12 hits"; non-numeric text passes through verbatim. */
const hitsBadge = (
  hits: string | number | undefined
): HitsBadge | undefined => {
  if (hits === undefined) {
    return undefined;
  }
  const text = String(hits);
  const n = typeof hits === "number" ? hits : Math.trunc(Number(text));
  if (Number.isNaN(n)) {
    return { label: text, n: undefined };
  }
  return { label: n === 0 ? "no hits" : `${text} hit${n === 1 ? "" : "s"}`, n };
};

export const Search = defineComponent(
  {
    description:
      "検索クエリ1行。pattern=検索パターン（必須）、path=対象スコープ、tool=ツール名 (rg/grep 等)、hits=ヒット数（0 は no hits、省略可）。children は注記",
    schema: v.looseObject({
      hits: v.optional(NUMISH),
      path: v.optional(v.string()),
      pattern: v.string(),
      tool: v.optional(v.string()),
    }),
  },
  ({ pattern, path, tool, hits, children }) => {
    const badge = hitsBadge(hits);
    return (
      <ListRow>
        <RowIcon name="lucide:search" />
        <code className={MONO_CLS}>{pattern}</code>
        {nonEmpty(path) ? <span className={LOC_CLS}>in {path}</span> : null}
        {nonEmpty(tool) ? <span className={MONO_TAG_CLS}>{tool}</span> : null}
        {badge === undefined ? null : (
          <Pill
            className={`shrink-0 ${
              badge.n !== undefined && badge.n > 0 ? TONE.emerald : TONE.neutral
            }`}
          >
            {badge.label}
          </Pill>
        )}
        <RowNote>{children}</RowNote>
      </ListRow>
    );
  }
);

const isSearchEl = (node: ReactNode): node is ReactElement =>
  isEl(node, Search);

/** A <Search> child's parsed hit count (0 when the badge is absent). */
const searchHits = (el: ReactElement): number => {
  const h = propOf(el, "hits");
  return typeof h === "string" || typeof h === "number"
    ? (hitsBadge(h)?.n ?? 0)
    : 0;
};

const summarizeSearches = (
  children: ReactNode
): { count: number; hits: number } => {
  let count = 0;
  let hits = 0;
  for (const node of flattenChildren(children)) {
    if (!isSearchEl(node)) {
      continue;
    }
    count += 1;
    hits += searchHits(node);
  }
  return { count, hits };
};

const searchSummary = (count: number, hits: number): string =>
  `${count} search${count === 1 ? "" : "es"}${hits > 0 ? ` · ${hits} hits` : ""}`;

export const Searches = defineComponent(
  {
    description:
      "検索クエリログのコンテナ。<Search> を並べる。title でキャプションバー、件数とヒット合計を上部に表示",
    schema: v.looseObject(TITLE_PROP),
  },
  ({ title, children }) => {
    const { count, hits } = summarizeSearches(children);
    return (
      <ListPanel title={title}>
        {count > 0 ? (
          <div className={`${SURFACE_CLS} px-4 py-1.5 text-xs ${TEXT.muted}`}>
            {searchSummary(count, hits)}
          </div>
        ) : null}
        {children}
      </ListPanel>
    );
  }
);

import { isValidElement } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { isRecord, nonEmpty } from "../guards.js";
import { Icon } from "./icon.js";

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
      hits: v.optional(v.union([v.string(), v.number()])),
      path: v.optional(v.string()),
      pattern: v.string(),
      tool: v.optional(v.string()),
    }),
  },
  ({ pattern, path, tool, hits, children }) => {
    const badge = hitsBadge(hits);
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
        <Icon
          className="h-3.5 w-3.5 shrink-0 self-center text-neutral-400 dark:text-neutral-500"
          name="lucide:search"
        />
        <code className="font-mono text-[0.85em] text-neutral-800 dark:text-neutral-200">
          {pattern}
        </code>
        {nonEmpty(path) ? (
          <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500">
            in {path}
          </span>
        ) : null}
        {nonEmpty(tool) ? (
          <span className="inline-flex shrink-0 items-center rounded border border-neutral-200 px-1.5 py-0.5 font-mono text-[0.7rem] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            {tool}
          </span>
        ) : null}
        {badge === undefined ? null : (
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              badge.n !== undefined && badge.n > 0
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
                : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
            }`}
          >
            {badge.label}
          </span>
        )}
        {children === undefined ? null : (
          <span className="min-w-0 flex-1 text-sm text-neutral-500 dark:text-neutral-400">
            {children}
          </span>
        )}
      </div>
    );
  }
);

export const Searches = defineComponent(
  {
    description:
      "検索クエリログのコンテナ。<Search> を並べる。title でキャプションバー、件数とヒット合計を上部に表示",
    schema: v.looseObject({
      title: v.optional(v.string()),
    }),
  },
  ({ title, children }) => {
    let count = 0;
    let hits = 0;
    for (const node of flattenChildren(children)) {
      if (!isValidElement(node) || node.type !== Search) {
        continue;
      }
      count += 1;
      const h = isRecord(node.props) ? node.props.hits : undefined;
      const badge = hitsBadge(
        typeof h === "string" || typeof h === "number" ? h : undefined
      );
      hits += badge?.n ?? 0;
    }
    return (
      <figure className="not-prose my-6 divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {nonEmpty(title) ? (
          <figcaption className="bg-neutral-50 px-4 py-2 text-xs font-medium text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
            {title}
          </figcaption>
        ) : null}
        {count > 0 ? (
          <div className="bg-neutral-50 px-4 py-1.5 text-xs text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
            {count} search{count === 1 ? "" : "es"}
            {hits > 0 ? ` · ${hits} hits` : ""}
          </div>
        ) : null}
        {children}
      </figure>
    );
  }
);

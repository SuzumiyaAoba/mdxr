import { Fragment, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren, textOf } from "../define.js";
import { nonEmpty } from "../guards.js";
import { fileIcon, folderIcon } from "./file-icon.js";
import { Icon } from "./icon.js";

type El = ReactElement<{ children?: ReactNode }>;

const isEl = (n: unknown, tag: string): n is El =>
  isValidElement<{ children?: ReactNode }>(n) && n.type === tag;

/** `name — note` or `name # note` inside a list item attaches a muted note. */
const NOTE_RE = /\s+(?:—|#)\s+/u;

const NodeIcon = ({
  dir,
  name,
}: {
  dir: boolean;
  name: string;
}): ReactElement => (
  <Icon
    className={`h-3.5 w-3.5 shrink-0 self-center ${dir ? "text-amber-500" : "text-neutral-400 dark:text-neutral-500"}`}
    name={dir ? folderIcon(name) : fileIcon(name)}
  />
);

/** Render a `<ul>` element (and its nested lists) as file-tree rows. */
const renderList = (node: El, depth: number): ReactElement => (
  <ul
    className={
      depth === 0
        ? "m-0 list-none space-y-0.5 p-0"
        : "mt-0.5 ml-[7px] list-none space-y-0.5 border-l border-neutral-200 p-0 pl-3 dark:border-neutral-700"
    }
  >
    {flattenChildren(node.props.children).map((child, i) => {
      if (!isEl(child, "li")) {
        return <Fragment key={i}>{child}</Fragment>;
      }
      const kids = flattenChildren(child.props.children);
      const nested = kids.filter((k): k is El => isEl(k, "ul"));
      const nestedSet = new Set<ReactNode>(nested);
      const row = kids
        .filter((k) => !nestedSet.has(k))
        .flatMap((k): ReactNode[] =>
          isEl(k, "p") ? flattenChildren(k.props.children) : [k]
        );

      const full = textOf(row);
      const m = NOTE_RE.exec(full);
      const name = m === null ? null : full.slice(0, m.index).trimEnd();
      const note = m === null ? null : full.slice(m.index + m[0].length).trim();
      const label = (name ?? full).trim();
      const isDir = nested.length > 0 || label.endsWith("/");

      return (
        <li key={child.key ?? i} className="relative">
          <div className="flex items-baseline gap-1.5 py-px">
            {depth > 0 ? (
              <span
                className="absolute top-[0.72em] -left-3 h-px w-2.5 bg-neutral-300 dark:bg-neutral-600"
                aria-hidden
              />
            ) : null}
            <NodeIcon dir={isDir} name={label} />
            <span className={isDir ? "font-medium" : undefined}>
              {name ?? row}
            </span>
            {note === null ? null : (
              <span className="text-[0.85em] text-neutral-400 dark:text-neutral-500">
                {note}
              </span>
            )}
          </div>
          {nested.map((ul, j) => (
            <Fragment key={ul.key ?? j}>{renderList(ul, depth + 1)}</Fragment>
          ))}
        </li>
      );
    })}
  </ul>
);

export const Tree = defineComponent(
  {
    description:
      "ファイルツリー。子のネストしたリストを描画する。末尾 `/` または子を持つ項目はフォルダ。`名前 — 注記` で注釈",
    schema: v.looseObject({
      root: v.optional(v.string()),
    }),
  },
  ({ root, children }) => (
    <div className="not-prose my-6 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm dark:border-neutral-800 dark:bg-neutral-900/60">
      {nonEmpty(root) ? (
        <div className="mb-1.5 flex items-center gap-1.5 font-semibold">
          <NodeIcon dir name={root} />
          {root}
        </div>
      ) : null}
      {flattenChildren(children).map((n, i) =>
        isEl(n, "ul") ? (
          <Fragment key={n.key ?? i}>{renderList(n, 0)}</Fragment>
        ) : (
          <Fragment key={i}>{n}</Fragment>
        )
      )}
    </div>
  )
);

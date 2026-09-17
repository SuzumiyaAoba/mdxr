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

/** `...` or `…` as the whole name marks intentionally omitted entries. */
const PLACEHOLDER_RE = /^(?:\.{3}|…)$/u;

const closed = (x: unknown): boolean => x === false || x === "false";

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

/** Horizontal tick joining a nested row to its parent's vertical rail. */
const Tick = (): ReactElement => (
  <span
    aria-hidden
    className="absolute top-[0.72em] -left-3 h-px w-2.5 bg-neutral-300 dark:bg-neutral-600"
  />
);

/**
 * Vertical rail joining a nested row to its siblings. `-top-0.5` bridges the
 * `space-y-0.5` gap between rows so the line stays continuous; on the last row
 * it stops at the tick, turning `├─` into `└─`.
 */
const Rail = ({ last }: { last: boolean }): ReactElement => (
  <span
    aria-hidden
    className={`absolute -top-0.5 -left-3 w-px bg-neutral-200 dark:bg-neutral-700 ${
      last ? "h-[calc(0.72em_+_3px)]" : "bottom-0"
    }`}
  />
);

/**
 * Column spacer matching the disclosure chevron's width so file rows align
 * with directory rows (which lead with a chevron, like Starlight's FileTree).
 */
const Spacer = (): ReactElement => (
  <span aria-hidden className="w-3 shrink-0" />
);

/** A tree row: guide tick plus its flex children. */
const Row = ({
  depth,
  children,
}: {
  children?: ReactNode;
  depth: number;
}): ReactElement => (
  <div className="flex items-baseline gap-1.5 py-px">
    {depth > 0 ? <Tick /> : null}
    {children}
  </div>
);

/** Muted `…` row marking omitted entries (Starlight-style placeholder). */
const PlaceholderRow = ({ depth }: { depth: number }): ReactElement => (
  <Row depth={depth}>
    <Spacer />
    <span className="text-neutral-400 dark:text-neutral-500">…</span>
  </Row>
);

/** Icon + name; wrapped in a highlight pill when the name was bold. */
const Entry = ({
  dir,
  highlighted,
  label,
  children,
}: {
  children?: ReactNode;
  dir: boolean;
  highlighted: boolean;
  label: string;
}): ReactElement => {
  const nameEl = (
    <span
      className={`group-hover:text-sky-600 dark:group-hover:text-sky-400${dir ? " font-medium" : ""}`}
    >
      {children}
    </span>
  );
  return highlighted ? (
    <span className="-mx-1 inline-flex items-baseline gap-1.5 rounded bg-amber-500/15 px-1 outline-1 outline-amber-500/35">
      <NodeIcon dir={dir} name={label} />
      {nameEl}
    </span>
  ) : (
    <>
      <NodeIcon dir={dir} name={label} />
      {nameEl}
    </>
  );
};

const nestedListCls = "mt-0.5 ml-[7px] list-none space-y-0.5 p-0 pl-3";

/** A list item's pieces: label/note text, nested <ul>s, inline row content. */
const rowParts = (
  child: El
): {
  label: string;
  name: string | null;
  nested: El[];
  note: string | null;
  row: ReactNode[];
} => {
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
  return { label: (name ?? full).trim(), name, nested, note, row };
};

/** Render a `<ul>` element (and its nested lists) as file-tree rows. */
const renderList = (
  node: El,
  depth: number,
  expanded: boolean
): ReactElement => {
  const renderItem = (child: El, last: boolean): ReactElement => {
    const { label, name, nested, note, row } = rowParts(child);

    // A `...`/`…` entry marks omitted files — no icon, not collapsible.
    if (PLACEHOLDER_RE.test(label)) {
      return (
        <li className="relative">
          {depth > 0 ? <Rail last={last} /> : null}
          <PlaceholderRow depth={depth} />
        </li>
      );
    }

    const isDir = nested.length > 0 || label.endsWith("/");
    const entry = (
      <Entry dir={isDir} highlighted={isEl(row[0], "strong")} label={label}>
        {name ?? row}
      </Entry>
    );
    const noteEl =
      note === null ? null : (
        <span className="text-[0.85em] text-neutral-400 dark:text-neutral-500">
          {note}
        </span>
      );

    if (!isDir) {
      return (
        <li className="relative">
          {depth > 0 ? <Rail last={last} /> : null}
          <Row depth={depth}>
            <Spacer />
            {entry}
            {noteEl}
          </Row>
        </li>
      );
    }

    // Directory: collapsible via native <details>. A bare `dir/` (no children)
    // starts closed and reveals a `…` placeholder — same as Starlight.
    return (
      <li className="relative">
        {depth > 0 ? <Rail last={last} /> : null}
        <details open={expanded && nested.length > 0}>
          <summary className="group flex cursor-pointer items-baseline gap-1.5 py-px select-none">
            {depth > 0 ? <Tick /> : null}
            <Icon
              className="mdxr-chev h-3 w-3 shrink-0 self-center text-neutral-400 group-hover:text-neutral-600 dark:text-neutral-500 dark:group-hover:text-neutral-300"
              name="lucide:chevron-right"
            />
            {entry}
            {noteEl}
          </summary>
          {nested.length > 0 ? (
            nested.map((ul, j) => (
              <Fragment key={ul.key ?? j}>
                {renderList(ul, depth + 1, expanded)}
              </Fragment>
            ))
          ) : (
            <ul className={nestedListCls}>
              <li className="relative">
                <Rail last />
                <PlaceholderRow depth={depth + 1} />
              </li>
            </ul>
          )}
        </details>
      </li>
    );
  };

  const items = flattenChildren(node.props.children);
  const lastLi = items.findLastIndex((c) => isEl(c, "li"));
  return (
    <ul
      className={depth === 0 ? "m-0 list-none space-y-0.5 p-0" : nestedListCls}
    >
      {items.map((child, i) => {
        if (!isEl(child, "li")) {
          return <Fragment key={i}>{child}</Fragment>;
        }
        return (
          <Fragment key={child.key ?? i}>
            {renderItem(child, i === lastLi)}
          </Fragment>
        );
      })}
    </ul>
  );
};

export const Tree = defineComponent(
  {
    description:
      'ファイルツリー。子のネストしたリストを描画する。末尾 `/` または子を持つ項目はフォルダでクリックで折り畳める (JS 不要)。open="false" で全フォルダを初期折り畳み。`名前 — 注記` で注釈、`...` または `…` で省略プレースホルダ、`**太字**` でハイライト',
    schema: v.looseObject({
      open: v.optional(v.union([v.boolean(), v.string()])),
      root: v.optional(v.string()),
    }),
  },
  ({ root, open, children }) => (
    <div className="mdxr-tree not-prose my-6 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm dark:border-neutral-800 dark:bg-neutral-900/60">
      {nonEmpty(root) ? (
        <div className="mb-1.5 flex items-center gap-1.5 font-semibold">
          <NodeIcon dir name={root} />
          {root}
        </div>
      ) : null}
      {flattenChildren(children).map((n, i) =>
        isEl(n, "ul") ? (
          <Fragment key={n.key ?? i}>
            {renderList(n, 0, !closed(open))}
          </Fragment>
        ) : (
          <Fragment key={i}>{n}</Fragment>
        )
      )}
    </div>
  )
);

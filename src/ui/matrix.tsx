import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren, textOf } from "../define.js";
import { nonEmpty } from "../guards.js";
import { Icon } from "./icon.js";

/**
 * Comparison matrix — rows come from a nested Markdown list, cells are
 * `|`-separated: `- Feature | yes | no | partial`. Cell values map to icons
 * (yes/✓ → check, no/✗ → cross, partial/~ → minus); anything else renders
 * as text. Column headers come from the `cols` prop.
 */

type CellKind = "empty" | "no" | "partial" | "text" | "yes";

const CELL_KINDS: Record<string, CellKind> = {
  "-": "empty",
  "?": "empty",
  false: "no",
  maybe: "partial",
  n: "no",
  ng: "no",
  no: "no",
  o: "yes",
  ok: "yes",
  partial: "partial",
  true: "yes",
  warn: "partial",
  x: "no",
  y: "yes",
  yes: "yes",
  "~": "partial",
  "×": "no",
  "–": "empty",
  "—": "empty",
  "△": "partial",
  "○": "yes",
  "✅": "yes",
  "✓": "yes",
  "✔": "yes",
  "✕": "no",
  "✗": "no",
  "✘": "no",
  "❌": "no",
  "？": "empty",
};

const cellKind = (cell: string): CellKind =>
  CELL_KINDS[cell.trim().toLowerCase()] ??
  (cell.trim() === "" ? "empty" : "text");

const Cell = ({ cell }: { cell: string }): ReactElement => {
  const kind = cellKind(cell);
  if (kind === "yes") {
    return (
      <Icon
        className="h-4 w-4 text-emerald-500"
        label="yes"
        name="lucide:check"
      />
    );
  }
  if (kind === "no") {
    return <Icon className="h-4 w-4 text-red-500" label="no" name="lucide:x" />;
  }
  if (kind === "partial") {
    return (
      <Icon
        className="h-4 w-4 text-amber-500"
        label="partial"
        name="lucide:minus"
      />
    );
  }
  if (kind === "empty") {
    return <span className="text-neutral-300 dark:text-neutral-600">—</span>;
  }
  return (
    <span className="text-xs text-neutral-600 dark:text-neutral-300">
      {cell.trim()}
    </span>
  );
};

type El = ReactElement<{ children?: ReactNode }>;

const isEl = (n: unknown, tag: string): n is El =>
  isValidElement<{ children?: ReactNode }>(n) && n.type === tag;

/** A list item → row cells: first `|`-segment is the label, rest are cells. */
const rowCells = (li: El): string[] => {
  const kids = flattenChildren(li.props.children);
  const text = kids
    .flatMap((k): ReactNode[] =>
      isEl(k, "p") ? flattenChildren(k.props.children) : [k]
    )
    .map((k) => textOf(k))
    .join("");
  return text.split("|").map((c) => c.trim());
};

/** Nested <ul>/<li> children → one cells array per list item. */
const collectRows = (children: ReactNode): string[][] => {
  const rows: string[][] = [];
  for (const child of flattenChildren(children)) {
    if (!isEl(child, "ul")) {
      continue;
    }
    for (const li of flattenChildren(child.props.children)) {
      if (isEl(li, "li")) {
        rows.push(rowCells(li));
      }
    }
  }
  return rows;
};

interface GridStyle {
  gridTemplateColumns: string;
}

const MatrixHeader = ({
  colCount,
  grid,
  headers,
}: {
  colCount: number;
  grid: GridStyle;
  headers: string[];
}): ReactElement => (
  <div
    className="grid border-b border-neutral-200 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-900/40"
    style={grid}
  >
    <div className="px-4 py-2" />
    {Array.from({ length: colCount }, (_, i) => (
      <div
        className="px-2 py-2 text-center text-xs font-semibold text-neutral-600 dark:text-neutral-300"
        key={i}
      >
        {headers[i] ?? ""}
      </div>
    ))}
  </div>
);

const MatrixRow = ({
  cells,
  colCount,
  grid,
}: {
  cells: string[];
  colCount: number;
  grid: GridStyle;
}): ReactElement => (
  <div className="grid items-center" style={grid}>
    <div className="px-4 py-2 text-sm font-medium">{cells[0]}</div>
    {Array.from({ length: colCount }, (_, j) => (
      <div className="px-2 py-2 text-center" key={j}>
        <Cell cell={cells[j + 1] ?? ""} />
      </div>
    ))}
  </div>
);

export const Matrix = defineComponent(
  {
    description:
      '比較マトリクス。cols はカンマ区切りの列名 ("Option A, Option B")。子のネストしたリスト1行が1行になり、"- 項目 | yes | no" のように | でセルを区切る。セル値 yes|no|partial|✓|✗|△|– はアイコン化、他は文字列のまま',
    schema: v.looseObject({
      cols: v.optional(v.string()),
      title: v.optional(v.string()),
    }),
  },
  ({ title, cols, children }) => {
    const headers = (cols ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c !== "");
    const rows = collectRows(children);
    const colCount = Math.max(
      headers.length,
      ...rows.map((r) => Math.max(0, r.length - 1)),
      1
    );
    const grid = {
      gridTemplateColumns: `minmax(8rem,1.4fr) repeat(${colCount}, minmax(4.5rem,1fr))`,
    };
    return (
      <figure className="not-prose my-6 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        {nonEmpty(title) ? (
          <figcaption className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-medium text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            {title}
          </figcaption>
        ) : null}
        {headers.length > 0 ? (
          <MatrixHeader colCount={colCount} grid={grid} headers={headers} />
        ) : null}
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
          {rows.map((cells, i) => (
            <MatrixRow cells={cells} colCount={colCount} grid={grid} key={i} />
          ))}
        </div>
      </figure>
    );
  }
);

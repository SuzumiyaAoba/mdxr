import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren, textOf } from "../define.js";
import { nonEmpty, own } from "../guards.js";
import { CaptionBar, Panel } from "./bits.js";
import { isEl } from "./children.js";
import { Icon } from "./icon.js";
import {
  BORDER_CLS,
  DIVIDE_CLS,
  SURFACE_CLS,
  TEXT,
  TONE_TEXT,
} from "./tones.js";

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

const cellKind = (cell: string): CellKind => {
  const key = cell.trim().toLowerCase();
  return own(CELL_KINDS, key) ?? (key === "" ? "empty" : "text");
};

const Cell = ({ cell }: { cell: string }): ReactElement => {
  const kind = cellKind(cell);
  if (kind === "yes") {
    return (
      <Icon
        className={`h-4 w-4 ${TONE_TEXT.emerald}`}
        label="yes"
        name="lucide:check"
      />
    );
  }
  if (kind === "no") {
    return (
      <Icon className={`h-4 w-4 ${TONE_TEXT.red}`} label="no" name="lucide:x" />
    );
  }
  if (kind === "partial") {
    return (
      <Icon
        className={`h-4 w-4 ${TONE_TEXT.amber}`}
        label="partial"
        name="lucide:minus"
      />
    );
  }
  if (kind === "empty") {
    return <span className={TEXT.ghost}>—</span>;
  }
  return <span className={`text-xs ${TEXT.body}`}>{cell.trim()}</span>;
};

type El = ReactElement<{ children?: ReactNode }>;

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
  <div className={`grid border-b ${SURFACE_CLS} ${BORDER_CLS}`} style={grid}>
    <div className="px-4 py-2" />
    {Array.from({ length: colCount }, (_, i) => (
      <div
        className={`px-2 py-2 text-center text-xs font-semibold ${TEXT.body}`}
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
      <Panel>
        {nonEmpty(title) ? (
          <CaptionBar className="font-medium">{title}</CaptionBar>
        ) : null}
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${8 + 4.5 * colCount}rem` }}>
            {headers.length > 0 ? (
              <MatrixHeader colCount={colCount} grid={grid} headers={headers} />
            ) : null}
            <div className={DIVIDE_CLS}>
              {rows.map((cells, i) => (
                <MatrixRow
                  cells={cells}
                  colCount={colCount}
                  grid={grid}
                  key={i}
                />
              ))}
            </div>
          </div>
        </div>
      </Panel>
    );
  }
);

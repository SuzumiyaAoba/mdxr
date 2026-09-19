import { Fragment } from "react";
import type { ReactElement, ReactNode } from "react";

import { nonEmpty } from "../guards.js";
import {
  AddCommentButton,
  CaptionBar,
  CommentStrip,
  CopyButton,
  MaybeLink,
  Panel,
} from "./bits.js";
import type { DiffHl, DiffHlToken, DiffRow, FileDiff } from "./diff-parse.js";
import { parseDiff } from "./diff-parse.js";
import { fileIcon } from "./file-icon.js";
import { useFileLink } from "./file-link.js";
import { Icon } from "./icon.js";
import {
  CAPTION_TITLE_CLS,
  LINK_CLS,
  MINI_CHIP_CLS,
  RAIL_BG_CLS,
  TEXT,
  TEXT_SUB,
  TONE,
  TONE_BAND,
  TONE_TEXT,
} from "./tones.js";

export { parseDiff } from "./diff-parse.js";
export type { FileDiff } from "./diff-parse.js";

/**
 * A comment thread anchored to a rendered diff row (`<Comments>`). `range`
 * selects rows by line number on `side` — the thread lands after the last
 * matching row, like a GitHub review comment; a range matching no row (and
 * a `range`-less, file-level comment) drops into the file card's tail.
 */
export interface DiffCommentSpec {
  /** Path selecting the file card; absent targets the first file. */
  file?: string;
  /** Raw `lines` spec — thread anchors and markdown copy reuse it. */
  lines?: string;
  /** Rendered comment card(s) injected at the anchor. */
  node: ReactNode;
  /** Inclusive line range on `side`; `end` undefined reads "to EOF". */
  range?: { end?: number; start: number };
  /** Side whose line numbers anchor the comment — `new` (default) or `old`. */
  side: "new" | "old";
}

/**
 * Unified-diff rendering. ```diff / ```patch fences route here via `Pre`,
 * so agents emit ordinary patches and get a structured view: per-file
 * headers with editor links, +/- counts and hunks with dual line numbers.
 * Bare `+`/`-` line streams render as a single anonymous file. Parsing
 * lives in `diff-parse.ts`.
 */

/** One block of the 5-block change meter. */
const blockCls = (i: number, green: number, hasChanges: boolean): string => {
  if (i < green) {
    return "bg-emerald-500";
  }
  return hasChanges ? "bg-red-400" : RAIL_BG_CLS;
};

/** GitHub-style 5-block change meter: green share ∝ adds/(adds+dels). */
const StatBlocks = ({
  adds,
  dels,
}: {
  adds: number;
  dels: number;
}): ReactElement => {
  const total = adds + dels;
  const green = total === 0 ? 0 : Math.min(5, Math.round((adds / total) * 5));
  return (
    <span aria-hidden className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          className={`h-2 w-2 rounded-[2px] ${blockCls(i, green, total > 0)}`}
          key={i}
        />
      ))}
    </span>
  );
};

const KINDS: Record<string, { cls: string; label: string }> = {
  deleted: {
    cls: TONE.red,
    label: "deleted",
  },
  new: {
    cls: TONE.emerald,
    label: "new file",
  },
  renamed: {
    cls: TONE.violet,
    label: "renamed",
  },
};

const fileKind = (f: FileDiff): string | undefined => {
  if (f.oldPath === undefined && f.newPath !== undefined) {
    return "new";
  }
  if (f.newPath === undefined && f.oldPath !== undefined) {
    return "deleted";
  }
  if (f.oldPath !== undefined && f.oldPath !== f.newPath) {
    return "renamed";
  }
  return undefined;
};

const ROW_CLS: Record<DiffRow["kind"], string> = {
  add: "bg-emerald-500/10 dark:bg-emerald-500/15",
  ctx: "",
  del: "bg-red-500/10 dark:bg-red-500/15",
  note: `${TEXT.faint} italic`,
};

const SIGN_CLS: Record<DiffRow["kind"], string> = {
  add: TONE_TEXT.emerald,
  ctx: TEXT.ghost,
  del: TONE_TEXT.red,
  note: TEXT.ghost,
};

const SIGNS: Record<DiffRow["kind"], string> = {
  add: "+",
  ctx: " ",
  del: "−",
  note: " ",
};

/** One line-number gutter cell — empty when the row has no line on this side. */
const LineNum = ({ n }: { n?: number }): ReactElement => (
  <span className={`px-2 text-right select-none ${TEXT.faint}`}>{n ?? ""}</span>
);

// Style strings repeat across tokens — same grammar color → same declaration.
const STYLE_CACHE = new Map<string, Record<string, string>>();

/** `--shiki-light:#fff;--shiki-dark:#fff` → a React style object. */
const shikiStyle = (style: string): Record<string, string> => {
  const hit = STYLE_CACHE.get(style);
  if (hit !== undefined) {
    return hit;
  }
  const out: Record<string, string> = {};
  for (const decl of style.split(";")) {
    const i = decl.indexOf(":");
    if (i > 0) {
      out[decl.slice(0, i).trim()] = decl.slice(i + 1).trim();
    }
  }
  STYLE_CACHE.set(style, out);
  return out;
};

/** Row text, or its language-highlighted tokens when rehypeShiki found a
 * grammar for the file (span vars are themed by the `.mdxr-diff-hl` rules). */
const RowContent = ({
  row,
  toks,
}: {
  row: DiffRow;
  toks?: DiffHlToken[] | null;
}): ReactNode => {
  if (toks === undefined || toks === null) {
    return nonEmpty(row.text) ? row.text : " ";
  }
  return toks.map((tok, i) => (
    <span
      className="mdxr-diff-hl"
      key={i}
      style={tok.s === undefined ? undefined : shikiStyle(tok.s)}
    >
      {tok.t}
    </span>
  ));
};

/** A row's add-comment anchor: del rows anchor old-side, add/ctx new-side;
 * note rows and unnumbered (implicit-hunk) rows can't anchor at all. */
const rowAnchor = (
  row: DiffRow
): { line: number; side: "new" | "old" } | undefined => {
  if (row.kind === "del") {
    return row.oldLine === undefined
      ? undefined
      : { line: row.oldLine, side: "old" };
  }
  if (row.kind === "add" || row.kind === "ctx") {
    return row.newLine === undefined
      ? undefined
      : { line: row.newLine, side: "new" };
  }
  return undefined;
};

const DiffRows = ({
  after,
  file,
  hlRows,
  rows,
}: {
  /** Comment threads keyed by row index — rendered under that row. */
  after?: ReadonlyMap<number, DiffCommentSpec[]>;
  /** Resolved card path — lands on the "+" button and strip anchors. */
  file?: string;
  hlRows?: (DiffHlToken[] | null)[];
  rows: DiffRow[];
}): ReactElement => (
  <div className="font-mono text-[0.8125rem] leading-5">
    {rows.map((row, i) => {
      const anchor = rowAnchor(row);
      const group = after?.get(i);
      const last = group?.at(-1);
      return (
        <Fragment key={i}>
          <div
            className={`mdxr-drow grid grid-cols-[2.5rem_2.5rem_1.25rem_minmax(0,1fr)] ${ROW_CLS[row.kind]}`}
            data-comment-row=""
          >
            {anchor === undefined ? null : (
              <AddCommentButton
                file={file}
                line={anchor.line}
                side={anchor.side}
              />
            )}
            <LineNum n={row.oldLine} />
            <LineNum n={row.newLine} />
            <span className={`text-center select-none ${SIGN_CLS[row.kind]}`}>
              {SIGNS[row.kind]}
            </span>
            <span
              className={`pr-4 wrap-anywhere whitespace-pre-wrap ${TEXT.code}`}
            >
              <RowContent row={row} toks={hlRows?.[i]} />
            </span>
          </div>
          {group === undefined ? null : (
            <CommentStrip
              anchor={{
                file,
                lines: last?.lines,
                side: last?.side,
              }}
            >
              {group.map((c): ReactNode => c.node)}
            </CommentStrip>
          )}
        </Fragment>
      );
    })}
  </div>
);

/** The last (document-order) row of `file` whose `side` line number falls
 * in `range` — GitHub anchors a range comment at its end. */
const anchorRow = (
  file: FileDiff,
  side: "new" | "old",
  range: { end?: number; start: number }
): { h: number; r: number } | undefined => {
  const { end, start } = range;
  let hit: { h: number; r: number } | undefined;
  for (const [hi, hunk] of file.hunks.entries()) {
    for (const [ri, row] of hunk.rows.entries()) {
      const ln = side === "old" ? row.oldLine : row.newLine;
      if (ln !== undefined && ln >= start && (end === undefined || ln <= end)) {
        hit = { h: hi, r: ri };
      }
    }
  }
  return hit;
};

/**
 * Group `comments` by their anchor row inside `file`: a thread hangs under
 * the last row (document order) whose `side` line number falls in its
 * range. Threads matching no row — plus file-level comments without a
 * range — collect in `tail` for a strip at the card's end.
 */
const anchorComments = (
  file: FileDiff,
  comments: readonly DiffCommentSpec[]
): {
  after: ReadonlyMap<number, DiffCommentSpec[]>[];
  tail: DiffCommentSpec[];
} => {
  const after = file.hunks.map(() => new Map<number, DiffCommentSpec[]>());
  const tail: DiffCommentSpec[] = [];
  for (const c of comments) {
    const hit =
      c.range === undefined ? undefined : anchorRow(file, c.side, c.range);
    if (hit === undefined) {
      tail.push(c);
      continue;
    }
    const rows = after[hit.h]?.get(hit.r) ?? [];
    rows.push(c);
    after[hit.h]?.set(hit.r, rows);
  }
  return { after, tail };
};

const FileCard = ({
  comments,
  fallbackPath,
  file,
  hl,
}: {
  comments?: readonly DiffCommentSpec[];
  fallbackPath?: string;
  file: FileDiff;
  hl?: (DiffHlToken[] | null)[][];
}): ReactElement => {
  const path = file.newPath ?? file.oldPath ?? fallbackPath;
  const link = useFileLink(path);
  const kind = fileKind(file);
  const label =
    file.oldPath !== undefined &&
    file.newPath !== undefined &&
    file.oldPath !== file.newPath
      ? `${file.oldPath} → ${file.newPath}`
      : (path ?? "diff");
  const anchored = anchorComments(file, comments ?? []);
  return (
    <Panel>
      <CaptionBar className={CAPTION_TITLE_CLS}>
        <Icon
          className="h-3.5 w-3.5 shrink-0"
          name={fileIcon(path ?? "x.diff")}
        />
        <MaybeLink
          className={`min-w-0 truncate font-mono ${LINK_CLS}`}
          href={link}
        >
          {label}
        </MaybeLink>
        {kind === undefined ? null : (
          <span className={`${MINI_CHIP_CLS} ${KINDS[kind].cls}`}>
            {KINDS[kind].label}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <span className="font-mono font-medium">
            <span className={TONE_TEXT.emerald}>+{file.adds}</span>{" "}
            <span className={TONE_TEXT.red}>−{file.dels}</span>
          </span>
          <StatBlocks adds={file.adds} dels={file.dels} />
          <CopyButton copy={file.raw.join("\n")} title="Copy diff" />
        </span>
      </CaptionBar>
      {file.meta.length > 0 ? (
        <div
          className={`border-b border-neutral-100 px-4 py-1.5 font-mono ${TEXT_SUB} dark:border-neutral-800/60 ${TEXT.faint}`}
        >
          {file.meta.map((m, i) => (
            <div className="truncate" key={i}>
              {m}
            </div>
          ))}
        </div>
      ) : null}
      <div className="overflow-x-auto">
        {file.hunks.map((h, i) => (
          <div key={i}>
            {nonEmpty(h.header) ? (
              <div
                className={`px-4 py-1 font-mono ${TEXT_SUB} ${TONE_BAND.sky}`}
              >
                {h.header}
              </div>
            ) : null}
            <DiffRows
              after={anchored.after[i]}
              file={path}
              hlRows={hl?.[i]}
              rows={h.rows}
            />
          </div>
        ))}
      </div>
      {anchored.tail.length === 0 ? null : (
        <CommentStrip anchor={{ file: path }}>
          {anchored.tail.map((c): ReactNode => c.node)}
        </CommentStrip>
      )}
    </Panel>
  );
};

/**
 * Fan `comments` out to file cards: a comment's `file` picks the first card
 * whose old or new path (or the fence's fallback filename) matches; absent
 * or unmatched `file` lands on the first card.
 */
const commentsPerFile = (
  files: FileDiff[],
  comments: readonly DiffCommentSpec[],
  fallbackPath?: string
): (readonly DiffCommentSpec[] | undefined)[] => {
  const perFile: DiffCommentSpec[][] = files.map(() => []);
  for (const c of comments) {
    const idx =
      c.file === undefined
        ? 0
        : files.findIndex(
            (f) =>
              f.newPath === c.file ||
              f.oldPath === c.file ||
              fallbackPath === c.file
          );
    perFile[Math.max(0, idx)]?.push(c);
  }
  return perFile;
};

/** Rendered by `Pre` for ```diff / ```patch fences. `hl` is the per-row
 * language highlighting parsed from the fence's `data-diffhl` (absent when
 * no grammar was resolved at compile time). */
export const DiffView = ({
  comments,
  filename,
  hl,
  text,
}: {
  comments?: readonly DiffCommentSpec[];
  filename?: string;
  hl?: DiffHl;
  text: string;
}): ReactElement | null => {
  const files = parseDiff(text).filter((f) => f.raw.length > 0);
  if (files.length === 0) {
    return null;
  }
  const perFile = commentsPerFile(files, comments ?? [], filename);
  return (
    <>
      {files.map((f, i) => (
        <FileCard
          comments={perFile[i]}
          fallbackPath={files.length === 1 ? filename : undefined}
          file={f}
          hl={hl?.[i]}
          key={i}
        />
      ))}
    </>
  );
};

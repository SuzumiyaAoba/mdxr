import type { ReactElement } from "react";

import { nonEmpty } from "../guards.js";
import { fileIcon } from "./file-icon.js";
import { linkTarget, useFileLink } from "./file-link.js";
import { Icon } from "./icon.js";

/**
 * Unified-diff parsing and rendering. ```diff / ```patch fences route here
 * via `Pre`, so agents emit ordinary patches and get a structured view:
 * per-file headers with editor links, +/- counts and hunks with dual line
 * numbers. Bare `+`/`-` line streams (no `diff --git`/`@@` headers) render
 * as a single anonymous file.
 */

interface DiffRow {
  kind: "add" | "ctx" | "del" | "note";
  newLine?: number;
  oldLine?: number;
  text: string;
}

interface DiffHunk {
  header?: string;
  rows: DiffRow[];
}

export interface FileDiff {
  adds: number;
  dels: number;
  hunks: DiffHunk[];
  meta: string[];
  newPath?: string;
  oldPath?: string;
  raw: string[];
}

const GIT_RE =
  /^diff --git "(?<aq>[^"]+)" "(?<bq>[^"]+)"|diff --git (?<a>\S+) (?<b>\S+)/u;
const OLD_RE = /^--- (?:"(?<q>[^"]+)"|(?<p>\S+))/u;
const NEW_RE = /^\+\+\+ (?:"(?<q>[^"]+)"|(?<p>\S+))/u;
const HUNK_RE =
  /^@@ -(?<o>\d+)(?:,(?<oc>\d+))? \+(?<n>\d+)(?:,(?<nc>\d+))? @@/u;
const RENAME_FROM_RE = /^rename from (?<p>.+)/u;
const RENAME_TO_RE = /^rename to (?<p>.+)/u;

/** `a/src/x.ts` → `src/x.ts`; quoted names unquoted; `/dev/null` → undefined. */
const cleanPath = (p: string | undefined): string | undefined => {
  if (p === undefined) {
    return undefined;
  }
  const unq = p.replaceAll(/^"|"$/gu, "").replace(/^[ab]\//u, "");
  return unq === "/dev/null" || unq === "" ? undefined : unq;
};

const newFile = (): FileDiff => ({
  adds: 0,
  dels: 0,
  hunks: [],
  meta: [],
  raw: [],
});

interface ParseState {
  cur?: FileDiff;
  files: FileDiff[];
  hunk?: DiffHunk;
  newNo: number;
  oldNo: number;
  /** True once the current file consumed a `---`/`+++` header line — the
   * paths a `diff --git` line sets don't count (a `---` after it belongs to
   * the same file, not a new one). */
  seenHeader: boolean;
}

/** Current file already carries content → a new `---` starts a new file. */
const hasContent = (st: ParseState): boolean =>
  st.cur !== undefined && (st.seenHeader || st.cur.hunks.length > 0);

const ensureFile = (st: ParseState): FileDiff => {
  if (st.cur === undefined) {
    st.cur = newFile();
    st.files.push(st.cur);
  }
  return st.cur;
};

const push = (st: ParseState, line: string): FileDiff => {
  const f = ensureFile(st);
  f.raw.push(line);
  return f;
};

/** `---`/`+++` file headers. Returns true when the line was consumed. */
const fileHeader = (st: ParseState, line: string): boolean => {
  const oldM = OLD_RE.exec(line);
  if (oldM?.groups !== undefined) {
    if (hasContent(st)) {
      st.cur = newFile();
      st.files.push(st.cur);
    }
    push(st, line).oldPath = cleanPath(oldM.groups.q ?? oldM.groups.p);
    st.hunk = undefined;
    st.seenHeader = true;
    return true;
  }
  const newM = NEW_RE.exec(line);
  if (newM?.groups !== undefined) {
    push(st, line).newPath = cleanPath(newM.groups.q ?? newM.groups.p);
    st.hunk = undefined;
    st.seenHeader = true;
    return true;
  }
  return false;
};

/** One row inside an active hunk; tracks both line counters. */
const hunkRow = (st: ParseState, line: string): void => {
  const { hunk } = st;
  if (hunk === undefined) {
    return;
  }
  const f = push(st, line);
  if (line.startsWith("\\")) {
    hunk.rows.push({ kind: "note", text: line });
  } else if (line.startsWith("+")) {
    f.adds += 1;
    hunk.rows.push({ kind: "add", newLine: st.newNo, text: line.slice(1) });
    st.newNo += 1;
  } else if (line.startsWith("-")) {
    f.dels += 1;
    hunk.rows.push({ kind: "del", oldLine: st.oldNo, text: line.slice(1) });
    st.oldNo += 1;
  } else {
    hunk.rows.push({
      kind: "ctx",
      newLine: st.newNo,
      oldLine: st.oldNo,
      text: line.startsWith(" ") ? line.slice(1) : line,
    });
    st.oldNo += 1;
    st.newNo += 1;
  }
};

/**
 * A line with no hunk context: file meta (index/mode/rename/binary) or the
 * first line of a bare +/- stream, which opens an implicit hunk.
 */
const looseLine = (st: ParseState, line: string): void => {
  const f = push(st, line);
  const rf = RENAME_FROM_RE.exec(line);
  if (rf?.groups !== undefined) {
    f.oldPath ??= cleanPath(rf.groups.p.trim());
  }
  const rt = RENAME_TO_RE.exec(line);
  if (rt?.groups !== undefined) {
    f.newPath ??= cleanPath(rt.groups.p.trim());
  }
  if (line.startsWith("+")) {
    f.adds += 1;
    st.hunk = { rows: [{ kind: "add", text: line.slice(1) }] };
    f.hunks.push(st.hunk);
  } else if (line.startsWith("-")) {
    f.dels += 1;
    st.hunk = { rows: [{ kind: "del", text: line.slice(1) }] };
    f.hunks.push(st.hunk);
  } else if (line !== "") {
    f.meta.push(line);
  }
};

/** One input line of `parseDiff`: git/file headers, `@@` hunk headers, and
 * hunk/loose content each consume the line and update `st`. */
const parseLine = (st: ParseState, line: string, nextLine: string): void => {
  const git = GIT_RE.exec(line);
  if (git?.groups !== undefined) {
    st.cur = newFile();
    st.files.push(st.cur);
    st.cur.raw.push(line);
    st.cur.oldPath = cleanPath(git.groups.aq ?? git.groups.a);
    st.cur.newPath = cleanPath(git.groups.bq ?? git.groups.b);
    st.hunk = undefined;
    st.seenHeader = false;
    return;
  }

  // A `---`/`+++` pair is a file header even mid-"hunk" (loose diffs).
  const pair = OLD_RE.test(line) && NEW_RE.test(nextLine);
  if ((st.hunk === undefined || pair) && fileHeader(st, line)) {
    return;
  }

  const hunkM = HUNK_RE.exec(line);
  if (hunkM?.groups !== undefined) {
    st.hunk = { header: line, rows: [] };
    push(st, line).hunks.push(st.hunk);
    st.oldNo = Number(hunkM.groups.o);
    st.newNo = Number(hunkM.groups.n);
    return;
  }

  if (st.hunk === undefined) {
    looseLine(st, line);
    return;
  }
  hunkRow(st, line);
};

/**
 * Parse unified-diff text into per-file structures. `--- `/`+++ ` count as
 * file headers only outside hunks (or when they form a `---`/`+++` pair —
 * inside a hunk a lone `-`-prefixed line is content). Lines with no diff
 * structure at all land in `meta`/`raw`; bare `+`/`-` streams without `@@`
 * headers collect into an implicit hunk.
 */
export const parseDiff = (text: string): FileDiff[] => {
  const lines = text.replace(/\n+$/u, "").split("\n");
  const st: ParseState = { files: [], newNo: 0, oldNo: 0, seenHeader: false };
  for (let i = 0; i < lines.length; i += 1) {
    parseLine(st, lines[i] ?? "", lines[i + 1] ?? "");
  }
  return st.files;
};

/** One block of the 5-block change meter. */
const blockCls = (i: number, green: number, hasChanges: boolean): string => {
  if (i < green) {
    return "bg-emerald-500";
  }
  return hasChanges ? "bg-red-400" : "bg-neutral-200 dark:bg-neutral-700";
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
    cls: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
    label: "deleted",
  },
  new: {
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    label: "new file",
  },
  renamed: {
    cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
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
  note: "text-neutral-400 italic dark:text-neutral-500",
};

const SIGN_CLS: Record<DiffRow["kind"], string> = {
  add: "text-emerald-600 dark:text-emerald-400",
  ctx: "text-neutral-300 dark:text-neutral-600",
  del: "text-red-600 dark:text-red-400",
  note: "text-neutral-300 dark:text-neutral-600",
};

const SIGNS: Record<DiffRow["kind"], string> = {
  add: "+",
  ctx: " ",
  del: "−",
  note: " ",
};

const DiffRows = ({ rows }: { rows: DiffRow[] }): ReactElement => (
  <div className="font-mono text-[0.8125rem] leading-5">
    {rows.map((row, i) => (
      <div
        className={`grid grid-cols-[2.5rem_2.5rem_1.25rem_minmax(0,1fr)] ${ROW_CLS[row.kind]}`}
        key={i}
      >
        <span className="px-2 text-right text-neutral-400 select-none dark:text-neutral-500">
          {row.oldLine ?? ""}
        </span>
        <span className="px-2 text-right text-neutral-400 select-none dark:text-neutral-500">
          {row.newLine ?? ""}
        </span>
        <span className={`text-center select-none ${SIGN_CLS[row.kind]}`}>
          {SIGNS[row.kind]}
        </span>
        <span className="pr-4 wrap-anywhere whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">
          {nonEmpty(row.text) ? row.text : " "}
        </span>
      </div>
    ))}
  </div>
);

const FileCard = ({
  fallbackPath,
  file,
}: {
  fallbackPath?: string;
  file: FileDiff;
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
  return (
    <figure className="not-prose my-6 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
      <figcaption className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        <Icon
          className="h-3.5 w-3.5 shrink-0"
          name={fileIcon(path ?? "x.diff")}
        />
        {link === undefined ? (
          <span className="min-w-0 truncate font-mono">{label}</span>
        ) : (
          <a
            className="min-w-0 truncate font-mono text-inherit no-underline hover:underline"
            href={link}
            {...linkTarget(link)}
          >
            {label}
          </a>
        )}
        {kind === undefined ? null : (
          <span
            className={`shrink-0 rounded-full px-1.5 py-px text-[0.65rem] font-medium ${KINDS[kind].cls}`}
          >
            {KINDS[kind].label}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <span className="font-mono font-medium">
            <span className="text-emerald-600 dark:text-emerald-400">
              +{file.adds}
            </span>{" "}
            <span className="text-red-600 dark:text-red-400">−{file.dels}</span>
          </span>
          <StatBlocks adds={file.adds} dels={file.dels} />
          <button
            aria-label="Copy diff"
            className="mdxr-copy cursor-pointer opacity-60"
            data-copy={file.raw.join("\n")}
            title="Copy diff"
            type="button"
          >
            <span className="mdxr-copy-idle inline-flex">
              <Icon className="h-3.5 w-3.5" name="lucide:copy" />
            </span>
            <span className="mdxr-copy-done hidden items-center text-emerald-600 dark:text-emerald-400">
              <Icon className="h-3.5 w-3.5" name="lucide:check" />
            </span>
          </button>
        </span>
      </figcaption>
      {file.meta.length > 0 ? (
        <div className="border-b border-neutral-100 px-4 py-1.5 font-mono text-[0.7rem] text-neutral-400 dark:border-neutral-800/60 dark:text-neutral-500">
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
              <div className="bg-sky-50 px-4 py-1 font-mono text-[0.72rem] text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                {h.header}
              </div>
            ) : null}
            <DiffRows rows={h.rows} />
          </div>
        ))}
      </div>
    </figure>
  );
};

/** Rendered by `Pre` for ```diff / ```patch fences. */
export const DiffView = ({
  filename,
  text,
}: {
  filename?: string;
  text: string;
}): ReactElement | null => {
  const files = parseDiff(text).filter((f) => f.raw.length > 0);
  if (files.length === 0) {
    return null;
  }
  return (
    <>
      {files.map((f, i) => (
        <FileCard
          fallbackPath={files.length === 1 ? filename : undefined}
          file={f}
          key={i}
        />
      ))}
    </>
  );
};

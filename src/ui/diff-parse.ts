/**
 * Unified-diff parsing. `parseDiff` turns patch text into per-file
 * structures; `DiffView` (diff.tsx) renders them. Bare `+`/`-` line
 * streams (no `diff --git`/`@@` headers) parse as a single anonymous file.
 */

export interface DiffRow {
  kind: "add" | "ctx" | "del" | "note";
  newLine?: number;
  oldLine?: number;
  text: string;
}

export interface DiffHunk {
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
  /^diff --git (?:"(?<aq>[^"]+)" "(?<bq>[^"]+)"|(?<a>\S+) (?<b>\S+))/u;
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
  /** Rows the declared hunk still expects on each side (Infinity for implicit
   * hunks — bare +/- streams have no header counts to bound them). */
  newLeft: number;
  newNo: number;
  oldLeft: number;
  oldNo: number;
  /** True once the current file consumed a `---`/`+++` header line — the
   * paths a `diff --git` line sets don't count (a `---` after it belongs to
   * the same file, not a new one). */
  seenHeader: boolean;
}

/** The active hunk still has rows to consume per its `@@` counts. */
const hunkLive = (st: ParseState): boolean =>
  st.hunk !== undefined &&
  st.hunk.header !== undefined &&
  (st.oldLeft > 0 || st.newLeft > 0);

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
  // Line numbers come from the `@@` tallies — an implicit hunk (bare +/-
  // stream) has none, so its rows must not inherit stale counters from the
  // previous counted hunk.
  const numbered = hunk.header !== undefined;
  const f = push(st, line);
  if (line.startsWith("\\")) {
    hunk.rows.push({ kind: "note", text: line });
  } else if (line.startsWith("+")) {
    f.adds += 1;
    st.newLeft -= 1;
    hunk.rows.push({
      kind: "add",
      newLine: numbered ? st.newNo : undefined,
      text: line.slice(1),
    });
    st.newNo += 1;
  } else if (line.startsWith("-")) {
    f.dels += 1;
    st.oldLeft -= 1;
    hunk.rows.push({
      kind: "del",
      oldLine: numbered ? st.oldNo : undefined,
      text: line.slice(1),
    });
    st.oldNo += 1;
  } else {
    st.oldLeft -= 1;
    st.newLeft -= 1;
    hunk.rows.push({
      kind: "ctx",
      newLine: numbered ? st.newNo : undefined,
      oldLine: numbered ? st.oldNo : undefined,
      text: line.startsWith(" ") ? line.slice(1) : line,
    });
    st.oldNo += 1;
    st.newNo += 1;
  }
  // A counted hunk is done when its `@@` tallies run out — the next `---` /
  // `diff --git` line is a file boundary again, not content.
  if (hunk.header !== undefined && st.oldLeft <= 0 && st.newLeft <= 0) {
    st.hunk = undefined;
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
    st.oldLeft = Number.POSITIVE_INFINITY;
    st.newLeft = Number.POSITIVE_INFINITY;
    st.hunk = { rows: [{ kind: "add", text: line.slice(1) }] };
    f.hunks.push(st.hunk);
  } else if (line.startsWith("-")) {
    f.dels += 1;
    st.oldLeft = Number.POSITIVE_INFINITY;
    st.newLeft = Number.POSITIVE_INFINITY;
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

  // A `---`/`+++` pair is a file header — but only once the current counted
  // hunk is exhausted. Inside a `@@` hunk body the pair is content: deleting
  // a line like `-- a/x` and adding `++ b/x` emits exactly those rows (e.g.
  // YAML frontmatter or nested diffs).
  const pair = OLD_RE.test(line) && NEW_RE.test(nextLine);
  if (
    (st.hunk === undefined || (pair && !hunkLive(st))) &&
    fileHeader(st, line)
  ) {
    return;
  }

  const hunkM = HUNK_RE.exec(line);
  if (hunkM?.groups !== undefined) {
    st.hunk = { header: line, rows: [] };
    push(st, line).hunks.push(st.hunk);
    st.oldNo = Number(hunkM.groups.o);
    st.newNo = Number(hunkM.groups.n);
    st.oldLeft = Number(hunkM.groups.oc ?? "1");
    st.newLeft = Number(hunkM.groups.nc ?? "1");
    return;
  }

  if (st.hunk === undefined) {
    // `\ No newline at end of file` follows the row it annotates — the hunk's
    // counters may already have closed it, but the note still belongs inside.
    const last = st.cur?.hunks.at(-1);
    if (line.startsWith("\\") && last !== undefined) {
      push(st, line);
      last.rows.push({ kind: "note", text: line });
      return;
    }
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
  // Normalize CRLF — a trailing \r would leak into row text and break the
  // regexes that test the *next* line's structure.
  const lines = text.replaceAll("\r\n", "\n").replace(/\n+$/u, "").split("\n");
  const st: ParseState = {
    files: [],
    newLeft: 0,
    newNo: 0,
    oldLeft: 0,
    oldNo: 0,
    seenHeader: false,
  };
  for (let i = 0; i < lines.length; i += 1) {
    parseLine(st, lines[i] ?? "", lines[i + 1] ?? "");
  }
  // Drop shells that never got content — an empty input would otherwise
  // yield one blank file card.
  return st.files.filter(
    (f) =>
      f.hunks.length > 0 ||
      f.meta.length > 0 ||
      f.oldPath !== undefined ||
      f.newPath !== undefined
  );
};

/** The shared `path:lines` grammar (`src/x.ts:40-52`, `…:40`, `…:40-`). */

/** "`src/a.ts:40-52`" → `{ path: "src/a.ts", lines: "40-52" }`. */
export const splitPathLines = (
  value: string
): { lines?: string; path: string } => {
  const m = /^(?<p>.+):(?<ls>\d+(?:-\d*)?)$/u.exec(value);
  return m?.groups === undefined
    ? { path: value }
    : { lines: m.groups.ls, path: m.groups.p };
};

/**
 * `lines="40-52"`, `lines="40"`, `lines="40-"` → 1-based inclusive range
 * (`end` undefined means "to EOF"). Invalid specs return undefined.
 */
export const parseLineRange = (
  spec: string
): { end: number | undefined; start: number } | undefined => {
  const m = /^(?<start>\d+)(?:-(?<end>\d*))?$/u.exec(spec.trim());
  if (m?.groups === undefined) {
    return undefined;
  }
  const start = Number(m.groups.start);
  let end: number | undefined;
  if (m.groups.end === undefined) {
    end = start;
  } else if (m.groups.end !== "") {
    end = Number(m.groups.end);
  }
  if (start < 1 || (end !== undefined && end < start)) {
    return undefined;
  }
  return { end, start };
};

/** "40-52" → "40" — the first line of a range spec, used for link targets. */
export const firstLine = (lines: string | undefined): string | undefined =>
  /^(?<n>\d+)/u.exec(lines ?? "")?.groups?.n;

/**
 * `title="x.ts"` / `filename='x.ts'` / `title=x.ts` inside a code-fence meta
 * string → the filename. Boundary-anchored: `data-title="x"` must not yield a
 * filename. Shared by `Pre`'s header and the diff highlighter's lang guess.
 */
export const fenceFilename = (meta: string): string | undefined =>
  /(?:^|\s)(?:title|filename)="(?<name>[^"]+)"/u.exec(meta)?.groups?.name ??
  /(?:^|\s)(?:title|filename)='(?<sq>[^']+)'/u.exec(meta)?.groups?.sq ??
  /(?:^|\s)(?:title|filename)=(?<name>[^\s"']+)/u.exec(meta)?.groups?.name;

/** `lang=ts` inside a fence meta string → the explicit language override. */
export const fenceLang = (meta: string): string | undefined =>
  /(?:^|\s)lang=(?<l>[\w+.#-]+)/u.exec(meta)?.groups?.l;

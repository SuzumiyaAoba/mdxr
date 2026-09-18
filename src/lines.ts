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

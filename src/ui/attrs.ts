import * as v from "valibot";

/**
 * MDX attributes arrive as strings: `open` → `""`, `open="false"` →
 * `"false"`. `attrTrue` treats presence/`"true"` as on; `attrFalse` treats
 * only an explicit `false`/`"false"` as off (absent stays open).
 */
export const attrTrue = (x: unknown): boolean =>
  x === true || x === "" || x === "true";

export const attrFalse = (x: unknown): boolean => x === false || x === "false";

const NUMBER_PREFIX = /^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/u;

/** Numeric part of `"40"`, `"-15"`, `"40%"`, `"120ms"`, `1.2` — suffix text is dropped. */
export const numOf = (x: unknown): number | undefined => {
  if (typeof x === "number") {
    return Number.isFinite(x) ? x : undefined;
  }
  if (typeof x !== "string") {
    return undefined;
  }
  const match = NUMBER_PREFIX.exec(x);
  const n = match === null ? Number.NaN : Number(match[0]);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Optional boolean-ish prop schema: accepts a JSX boolean or an MDX string
 * attribute; read it back with `attrTrue`/`attrFalse`.
 */
export const BOOLISH_PROP = v.optional(v.union([v.boolean(), v.string()]));

/**
 * String-or-number prop atom: MDX attributes arrive as strings but JSX
 * expressions like `duration={300}` produce real numbers — both are valid.
 * Required sites use it bare (`id: NUMISH`); optional sites wrap it.
 */
export const NUMISH = v.union([v.string(), v.number()]);

/** Optional `title` — the heading attribute most containers share. */
export const TITLE_PROP = { title: v.optional(v.string()) } as const;

/** `href` + `lines` — the link-override pair shared by file-referencing props. */
export const LINK_LINES_PROPS = {
  href: v.optional(v.string()),
  lines: v.optional(v.string()),
} as const;

/** Optional `href`/`lines`/`path` — the full file-link attribute triple. */
export const FILE_LINK_PROPS = {
  ...LINK_LINES_PROPS,
  path: v.optional(v.string()),
} as const;

import * as v from "valibot";

/**
 * MDX attributes arrive as strings: `open` → `""`, `open="false"` →
 * `"false"`. `attrTrue` treats presence/`"true"` as on; `attrFalse` treats
 * only an explicit `false`/`"false"` as off (absent stays open).
 */
export const attrTrue = (x: unknown): boolean =>
  x === true || x === "" || x === "true";

export const attrFalse = (x: unknown): boolean => x === false || x === "false";

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

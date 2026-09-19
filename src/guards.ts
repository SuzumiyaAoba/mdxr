/** Runtime type guards shared across AST/config/module boundaries. */

import type { AnyComponent } from "./define.js";

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/** `React.memo`/`forwardRef`/`lazy` results are objects, not functions —
 * but they are still valid element types for the MDX components map. */
const REACT_COMPONENT_OBJECTS = new Set<symbol>([
  Symbol.for("react.memo"),
  Symbol.for("react.forward_ref"),
  Symbol.for("react.lazy"),
]);

export const isComponent = (v: unknown): v is AnyComponent =>
  typeof v === "function" ||
  (isRecord(v) &&
    typeof v.$$typeof === "symbol" &&
    REACT_COMPONENT_OBJECTS.has(v.$$typeof));

/** Treat "" as absent — document attributes arrive as strings. */
export const nonEmpty = (v: unknown): v is string =>
  typeof v === "string" && v !== "";

/** String-or-undefined narrow — unlike `nonEmpty`, "" passes through. */
export const asString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

/** Membership-guard factory: `isOneOf(STATUSES)` narrows to the list's union. */
export const isOneOf =
  <T extends string>(list: readonly T[]) =>
  (x: unknown): x is T =>
    typeof x === "string" && (list as readonly string[]).includes(x);

/**
 * Prototype-safe record lookup — `table[key]` only for own properties, so
 * keys like "toString" or "constructor" can't leak members off `Object`'s
 * prototype. Use wherever document-supplied strings index a table.
 */
export const own = <T>(
  table: Readonly<Record<string, T>>,
  key: string
): T | undefined => (Object.hasOwn(table, key) ? table[key] : undefined);

const SAFE_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

/**
 * The scheme a browser would parse out of `v`, lowercased — or undefined for
 * scheme-less values. Browsers strip \t\n\r anywhere in a URL and remove
 * leading/trailing C0 controls and spaces before scheme parsing
 * ("  javascript:…", "java\tscript:…", "\x01javascript:…" all execute), so
 * the probe uses the same normalized form.
 */
export const urlScheme = (v: string): string | undefined => {
  /* oxlint-disable no-control-regex -- C0 range is the point: the URL parser
     strips it at the edges, so the probe must too */
  const probe = v
    .replaceAll(/[\t\n\r]/gu, "")
    .replace(/^[\u0000-\u0020]+/u, "")
    .replace(/[\u0000-\u0020]+$/u, "");
  /* oxlint-enable no-control-regex */
  return /^(?<scheme>[a-zA-Z][a-zA-Z0-9+.-]*):/u
    .exec(probe)
    ?.groups?.scheme.toLowerCase();
};

/**
 * Doc-supplied `href` props pass through to `<a href>` unescaped — a
 * `javascript:`/`data:` scheme would execute on click. Allow only web
 * schemes plus scheme-less values (anchors, relative and protocol-relative
 * URLs); anything else renders as no link. Editor URLs (`vscode:` etc.)
 * never take this path — they come from the server-side `fileLink`.
 */
export const safeHref = (v: unknown): string | undefined => {
  if (typeof v !== "string" || v === "") {
    return undefined;
  }
  const scheme = urlScheme(v);
  if (scheme === undefined || SAFE_SCHEMES.has(scheme)) {
    return v;
  }
  return undefined;
};

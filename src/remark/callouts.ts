/** Callout kinds shared by `:::kind` directives and `> [!KIND]` alerts. */

export const CALLOUT_KINDS = new Set([
  "note",
  "tip",
  "important",
  "warning",
  "caution",
  "danger",
  "decision",
  "goal",
  "nongoal",
  "question",
  "answer",
]);

/** Lowercases and maps the `non-goal`/`nongoal` spellings to `nongoal`. */
export const normalizeCalloutKind = (kind: string): string =>
  kind.toLowerCase().replace(/^non-goal$/u, "nongoal");

/** GitHub alert marker: `> [!WARNING]` — kinds derived from CALLOUT_KINDS. */
export const ALERT_RE = new RegExp(
  `^\\[!(?<kind>${[...CALLOUT_KINDS].map((k) => (k === "nongoal" ? "non-?goal" : k)).join("|")})\\]\\s*`,
  "iu"
);

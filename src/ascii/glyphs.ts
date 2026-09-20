/** ASCII/block-element drawing helpers shared by the chart renderers. */

/** `█`-bar of `width` cells filled to `frac` (0–1), e.g. `██████░░░░`. */
export const bar = (
  frac: number,
  width: number,
  fill = "█",
  empty = "░"
): string => {
  const n = Math.max(0, Math.min(width, Math.round(frac * width)));
  return fill.repeat(n) + empty.repeat(width - n);
};

const SPARK_CHARS = "▁▂▃▄▅▆▇█";

/** Unicode sparkline (`▁▃▅▇`) for a numeric series; "" under 2 points. */
export const spark = (values: number[]): string => {
  if (values.length < 2) {
    return "";
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  return values
    .map(
      (v) =>
        SPARK_CHARS[
          span === 0
            ? 3
            : Math.min(
                SPARK_CHARS.length - 1,
                Math.floor(((v - min) / span) * SPARK_CHARS.length)
              )
        ]
    )
    .join("");
};

/**
 * Status → glyph used across statused lists (steps, tests, checks, lanes).
 * done/pass/approved → ✓ · doing/running → ◐ · todo/pending → ○ ·
 * blocked/fail/rejected → ✗ · skip → – · milestone/current → ◆
 */
export const STATUS_ICON: Record<string, string> = {
  approved: "✓",
  blocked: "✗",
  confirmed: "✓",
  degraded: "▲",
  doing: "◐",
  done: "✓",
  down: "✗",
  fail: "✗",
  inferred: "◐",
  maint: "◆",
  maintenance: "◆",
  none: "·",
  operational: "✓",
  outage: "✗",
  pass: "✓",
  pending: "○",
  refuted: "✗",
  rejected: "✗",
  resolved: "✓",
  running: "◐",
  skip: "–",
  supported: "✓",
  todo: "○",
  untested: "○",
  unverified: "?",
  up: "✓",
};

export const statusIcon = (status: string | undefined): string =>
  status === undefined ? "•" : (STATUS_ICON[status.toLowerCase()] ?? "•");

/** Left-align `s` in a `width`-wide column (no padding past the width). */
export const pad = (s: string, width: number): string =>
  s.length >= width ? s : s + " ".repeat(width - s.length);

/** `12.3%` — compact percent label. */
export const pct = (n: number): string => `${Math.round(n * 10) / 10}%`;

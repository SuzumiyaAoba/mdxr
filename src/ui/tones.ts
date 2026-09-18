/**
 * Semantic color pairs for pill/chip surfaces — `bg-{c}-100 text-{c}-700`
 * with the dark-mode counterparts. Shared so every status badge, risk chip,
 * and confidence pill stays visually consistent (and one edit restyles all).
 */
export const TONE = {
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  neutral:
    "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  orange:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
  violet:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
} as const;

export type Tone = keyof typeof TONE;

/**
 * Neutral text-tone pairs, strongest→faintest. Use these instead of open-
 * coding `text-neutral-* dark:text-neutral-*` so the muted-text hierarchy
 * stays consistent across the catalog.
 */
export const TEXT = {
  /** Secondary body text (neutral-600/300). */
  body: "text-neutral-600 dark:text-neutral-300",
  /** Code/mono-context body (neutral-800/200). */
  code: "text-neutral-800 dark:text-neutral-200",
  /** Faint placeholders, locations, icons (neutral-400/500). */
  faint: "text-neutral-400 dark:text-neutral-500",
  /** Ghosted context lines, empty cells (neutral-300/600). */
  ghost: "text-neutral-300 dark:text-neutral-600",
  /** Muted annotations, captions, meta (neutral-500/400). */
  muted: "text-neutral-500 dark:text-neutral-400",
  /** Headings, term names, primary labels (neutral-900/100). */
  strong: "text-neutral-900 dark:text-neutral-100",
} as const;

/** Muted mono chip text — the `path:lines` location label shared by
 * file-referencing components (Flow, Trace, Tests, Search, Approvals). */
export const LOC_CLS = `font-mono text-xs ${TEXT.faint}`;

/** Inline `<code>` look inside list rows — `font-mono` on the body text color. */
export const MONO_CLS = `font-mono text-[0.85em] ${TEXT.code}`;

/** Trim first/last child margins inside MDX-rendered body regions. */
export const TRIM_CLS = "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0";

/** Standard neutral border — panels, cards, dividers (neutral-200/800). */
export const BORDER_CLS = "border-neutral-200 dark:border-neutral-800";

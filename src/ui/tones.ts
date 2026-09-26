/**
 * Semantic color pairs for pill/chip surfaces — `bg-{c}-100 text-{c}-700`
 * with the dark-mode counterparts. Shared so every status badge, risk chip,
 * and confidence pill stays visually consistent (and one edit restyles all).
 */
export const TONE = {
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  indigo:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300",
  neutral:
    "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  orange:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-900/60 dark:text-teal-300",
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
  /** Interactive chip/control labels (neutral-700/200). */
  chip: "text-neutral-700 dark:text-neutral-200",
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

/**
 * Text-only accent pairs (`text-{c}-600 dark:text-{c}-400`) — the single
 * accent scale for tag labels, status icons, +/- counts, and graph edges.
 * `neutral` maps to `TEXT.muted`. Standalone fills (dots, bars) keep
 * `bg-{c}-500` and need no dark variant.
 */
export const TONE_TEXT = {
  amber: "text-amber-600 dark:text-amber-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  neutral: "text-neutral-500 dark:text-neutral-400",
  orange: "text-orange-600 dark:text-orange-400",
  red: "text-red-600 dark:text-red-400",
  sky: "text-sky-600 dark:text-sky-400",
  teal: "text-teal-600 dark:text-teal-400",
  violet: "text-violet-600 dark:text-violet-400",
} as const;

/**
 * Lightly tinted bands (`bg-{c}-50 text-{c}-700`, dark `950/40` + `300`) —
 * inline alert strips inside panels: Trace errors, Before/After headers,
 * diff hunk markers. Callout bodies stay on their own deeper `950/100`
 * variant since they carry prose.
 */
export const TONE_BAND = {
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  emerald:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  indigo:
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  neutral:
    "bg-neutral-100 text-neutral-700 dark:bg-neutral-800/70 dark:text-neutral-300",
  orange:
    "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  red: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  teal: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  violet:
    "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
} as const;

/**
 * 1px tinted card borders (`border-{c}-200 dark:border-{c}-900/60`) — the
 * outline for tone-tinted cards (Option, Before/After). `neutral` is the
 * standard panel border. Left-accent bars (Callout/Risk `border-l-4`) keep
 * the stronger `border-{c}-500` since a 4px strip is the accent itself.
 */
export const TONE_BORDER = {
  amber: "border-amber-200 dark:border-amber-900/60",
  emerald: "border-emerald-200 dark:border-emerald-900/60",
  indigo: "border-indigo-200 dark:border-indigo-900/60",
  neutral: "border-neutral-200 dark:border-neutral-800",
  orange: "border-orange-200 dark:border-orange-900/60",
  red: "border-red-200 dark:border-red-900/60",
  sky: "border-sky-200 dark:border-sky-900/60",
  teal: "border-teal-200 dark:border-teal-900/60",
  violet: "border-violet-200 dark:border-violet-900/60",
} as const;

/** Tiny chip/tick-label size — counts, method badges, axis labels (10.4px). */
export const TEXT_MICRO = "text-[0.65rem]";

/** Small secondary line — sub-labels under names, dense meta rows (11.2px). */
export const TEXT_SUB = "text-[0.7rem]";

/** Muted mono chip text — the `path:lines` location label shared by
 * file-referencing components (Flow, Trace, Tests, Search, Approvals). */
export const LOC_CLS = `font-mono text-xs ${TEXT.faint}`;

/** Inline `<code>` look inside list rows — `font-mono` on the body text color. */
export const MONO_CLS = `font-mono text-[0.85em] ${TEXT.code}`;

/** Trim first/last child margins inside MDX-rendered body regions. */
export const TRIM_CLS = "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0";

/** Standard neutral border — panels, cards, dividers (neutral-200/800). */
export const BORDER_CLS = "border-neutral-200 dark:border-neutral-800";

/** CommentStrip's class list — shared with the `<template>` clone in
 * `<Comments>` so strips the client inserts match SSR output. `bleed`
 * stretches the strip across a parent's `px-4` padding (annotated code
 * blocks sit inside one). */
export const commentStripCls = (bleed?: boolean): string =>
  `border-t ${BORDER_CLS} space-y-3 bg-white py-3 font-sans text-sm whitespace-normal dark:bg-neutral-950 ${
    bleed === true ? "-mx-4 px-4" : "px-4"
  }`;

/** Stronger border for controls and chips — inputs, code chips, marked
 * squares (neutral-300/700). */
export const CHIP_BORDER_CLS = "border-neutral-300 dark:border-neutral-700";

/** Caption-strip surface — header/footer bars inside panels (neutral-50/900). */
export const SURFACE_CLS = "bg-neutral-50 dark:bg-neutral-900";

/** Sunken content surface — file trees, JSON/code viewers, graph canvases
 * (neutral-50 light, softer `900/60` dark so it sits under the card bg). */
export const SUNKEN_CLS = "bg-neutral-50 dark:bg-neutral-900/60";

/** Connector/guide lines in border form — timeline rails, JSON indent guides
 * (a hair darker than BORDER_CLS in dark mode since they are functional). */
export const RAIL_CLS = "border-neutral-200 dark:border-neutral-700";

/** Connector/guide lines in background form — flow stems, chart gridlines,
 * tree rails. */
export const RAIL_BG_CLS = "bg-neutral-200 dark:bg-neutral-700";

/** Sunken track behind progress/timing bars — Summary, Gantt, Waterfall. */
export const TRACK_CLS = "bg-neutral-100 dark:bg-neutral-800";

/** Inherit-color link that underlines on hover — chips/labels inside panels. */
export const LINK_CLS = "text-inherit no-underline hover:underline";

/** Indented tree-line row — Json nodes and file-Tree entries. */
export const TREE_ROW_CLS = "flex items-baseline gap-1.5 py-px";

/** Clickable inline fold row — `<summary>` of a tree-line <details> (Tree, Json). */
export const DISCLOSURE_ROW_CLS =
  "flex cursor-pointer items-baseline gap-1.5 py-px select-none";

/** CaptionBar layout for icon+title headers (Graph/Gantt/Waterfall/Endpoints). */
export const CAPTION_TITLE_CLS = "flex items-center gap-2 font-medium";

/** Right-aligned mono digits in a titled caption (Gantt/Waterfall). */
export const MONO_NUM_CLS = "font-mono font-normal tabular-nums";

/** Soft inner divider rows inside panels (Ask questions, Matrix, Props). */
export const DIVIDE_CLS =
  "divide-y divide-neutral-100 dark:divide-neutral-800/60";

/** Tiny pill shape — counts, tags, diff file kinds. Callers add a TONE/bg. */
export const MINI_CHIP_CLS = `inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px font-medium ${TEXT_MICRO}`;

/** Muted count/tag chip on tinted surfaces — Json key counts, Tests tool
 * tags, Board lane counts (neutral-200/70 so it reads on neutral-50/100). */
export const COUNT_CHIP_CLS = `${MINI_CHIP_CLS} bg-neutral-200/70 font-mono ${TEXT.muted} dark:bg-neutral-800`;

/** Bordered mono tag — search tool names, graph edge labels. */
export const MONO_TAG_CLS = `inline-flex shrink-0 items-center rounded border ${CHIP_BORDER_CLS} bg-white px-1.5 py-0.5 font-mono ${TEXT_SUB} ${TEXT.muted} dark:bg-neutral-900`;

/** Left-accent panels (Callout, Risk, Verdict) use square corners. */
export const EDGE_PANEL_CLS = "my-6 border-l-4 px-4 py-3 text-sm";

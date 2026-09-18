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

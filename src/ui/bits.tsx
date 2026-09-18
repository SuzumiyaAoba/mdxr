import type { ReactElement, ReactNode } from "react";

import { nonEmpty } from "../guards.js";
import { indexChildren } from "./child-index.js";
import { Icon } from "./icon.js";

/**
 * Click-to-copy button. The `mdxr-copy`/`mdxr-copy-idle`/`mdxr-copy-done`
 * classes are client-JS hooks (assets.ts toggles `.copied` on the button) —
 * rename them and copy stops working.
 */
export const CopyButton = (props: {
  /** Extra button classes (default `opacity-60`). */
  className?: string;
  /** Clipboard payload (`data-copy`). */
  copy: string;
  /** Done-state color classes (default light+dark emerald). */
  doneClassName?: string;
  /** Tooltip + accessible label. */
  title: string;
}): ReactElement => (
  <button
    aria-label={props.title}
    className={`mdxr-copy cursor-pointer ${props.className ?? "opacity-60"}`}
    data-copy={props.copy}
    title={props.title}
    type="button"
  >
    <span className="mdxr-copy-idle inline-flex">
      <Icon className="h-3.5 w-3.5" name="lucide:copy" />
    </span>
    <span
      className={`mdxr-copy-done hidden items-center ${props.doneClassName ?? "text-emerald-600 dark:text-emerald-400"}`}
    >
      <Icon className="h-3.5 w-3.5" name="lucide:check" />
    </span>
  </button>
);

/** Round status/kind chip — icon + label on a `TONE` background. */
export const Pill = (props: {
  children?: ReactNode;
  /** Tone/color classes appended after the pill shape. */
  className?: string;
  /** Iconify name, e.g. `lucide:check`. */
  icon?: string;
}): ReactElement => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${props.className ?? ""}`}
  >
    {props.icon === undefined ? null : (
      <Icon className="h-3 w-3" name={props.icon} />
    )}
    {props.children}
  </span>
);

const CAPTION_BASE =
  "bg-neutral-50 px-4 py-2 text-xs text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400";
const CAPTION_BORDER = "border-b border-neutral-200 dark:border-neutral-800";

/**
 * Header strip on framed blocks (code, diffs, tables). `border` (default on)
 * draws the divider to the body; `className` adds layout like
 * `flex items-center gap-2` or weight like `font-medium`/`font-mono`.
 */
export const CaptionBar = (props: {
  border?: boolean;
  children?: ReactNode;
  className?: string;
}): ReactElement => (
  <figcaption
    className={`${props.border === false ? "" : `${CAPTION_BORDER} `}${CAPTION_BASE} ${props.className ?? ""}`}
  >
    {props.children}
  </figcaption>
);

/** Small numbered square used by list items indexed via `useChildIndex`. */
export const NumBadge = (props: { n: number }): ReactElement => (
  <span className="flex h-5 w-5 items-center justify-center rounded-md border border-neutral-300 font-mono text-[0.7em] font-medium text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
    {props.n}
  </span>
);

/**
 * Bordered card for counted list items (Finding, Hypothesis): index badge +
 * a pill slot + optional title + prose children.
 */
export const IndexedCard = (props: {
  children?: ReactNode;
  /** 1-based index from `useChildIndex`; 0 hides the badge. */
  n: number;
  /** Status pill (usually `<Pill>`). */
  pill: ReactNode;
  title?: string;
}): ReactElement => (
  <article className="rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {props.n > 0 ? <NumBadge n={props.n} /> : null}
      {props.pill}
      {nonEmpty(props.title) ? (
        <span className="text-sm font-medium">{props.title}</span>
      ) : null}
    </div>
    {props.children === undefined ? null : (
      <div className="mt-1.5 text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {props.children}
      </div>
    )}
  </article>
);

/**
 * Section wrapper for counted item lists (Findings, Hypotheses): optional
 * heading, a `N items · n status` summary line, then indexed children.
 */
export const CountedList = (props: {
  children?: ReactNode;
  /** prop value → count, e.g. `{confirmed: 2, inferred: 1}`. */
  counts: ReadonlyMap<string, number>;
  /** Display label for a count key (rendered lowercased by callers). */
  labelOf: (key: string) => string;
  /** `[singular, plural]` noun for the total line. */
  noun: readonly [string, string];
  /** Fixed display order for the per-key counts. */
  order: readonly string[];
  title?: string;
}): ReactElement => {
  const total = [...props.counts.values()].reduce((a, b) => a + b, 0);
  return (
    <section className="my-6">
      {nonEmpty(props.title) ? <h3 className="mt-0">{props.title}</h3> : null}
      {total > 0 ? (
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
          <span>
            {total} {props.noun[total === 1 ? 0 : 1]}
          </span>
          {props.order.map((k) => {
            const count = props.counts.get(k);
            return count === undefined ? null : (
              <span key={k}>
                · {count} {props.labelOf(k)}
              </span>
            );
          })}
        </div>
      ) : null}
      <div className="not-prose space-y-3">{indexChildren(props.children)}</div>
    </section>
  );
};

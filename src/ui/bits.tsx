import type { ReactElement, ReactNode } from "react";

import { nonEmpty } from "../guards.js";
import { indexChildren } from "./child-index.js";
import { linkTarget, useFileLink } from "./file-link.js";
import { Icon } from "./icon.js";
import {
  BORDER_CLS,
  CHIP_BORDER_CLS,
  LOC_CLS,
  SURFACE_CLS,
  TEXT,
  TEXT_MICRO,
  TEXT_SUB,
  TONE_TEXT,
  TRIM_CLS,
} from "./tones.js";

/**
 * Bordered panel shape framing a document block (code, diffs, graphs,
 * tables). Exported for panels needing a non-figure tag (`<nav>`, `<section>`)
 * or extra attributes; plain panels should use `<Panel>`.
 */
export const PANEL_CLS = `not-prose my-6 overflow-hidden rounded-lg border ${BORDER_CLS}`;

export const Panel = (props: {
  children?: ReactNode;
  /** Extra classes (e.g. `mdxr-json`) merged after the panel shape. */
  className?: string;
}): ReactElement => (
  <figure className={`${PANEL_CLS} ${props.className ?? ""}`}>
    {props.children}
  </figure>
);

// Lookup maps (not `items-${x}` interpolation) so Tailwind's static class
// scan sees the literals.
const ROW_ALIGN = {
  baseline: "items-baseline",
  center: "items-center",
} as const;
const ROW_GAP_X = {
  "2": "gap-x-2",
  "2.5": "gap-x-2.5",
  "3": "gap-x-3",
} as const;

/** One padded row inside a `ListPanel`. */
export const ListRow = (props: {
  /** `items-*` — default `items-baseline`. */
  align?: keyof typeof ROW_ALIGN;
  children?: ReactNode;
  /** Non-conflicting extras, e.g. `opacity-60`. */
  className?: string;
  /** `gap-x-*` — default `gap-x-3`. */
  gapX?: keyof typeof ROW_GAP_X;
}): ReactElement => (
  <div
    className={`flex flex-wrap ${ROW_ALIGN[props.align ?? "baseline"]} ${ROW_GAP_X[props.gapX ?? "3"]} gap-y-1 px-4 py-2.5 ${props.className ?? ""}`}
  >
    {props.children}
  </div>
);

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
      className={`mdxr-copy-done hidden items-center ${props.doneClassName ?? TONE_TEXT.emerald}`}
    >
      <Icon className="h-3.5 w-3.5" name="lucide:check" />
    </span>
  </button>
);

/**
 * Bordered secondary-button shape for labeled copy/save actions (Ask,
 * Board). `transition-colors` only — `transition-all` would animate layout
 * properties too.
 */
export const ACTION_BUTTON_CLS = `inline-flex cursor-pointer items-center rounded-md border ${CHIP_BORDER_CLS} bg-white px-2.5 py-1 text-xs font-medium ${TEXT.chip} transition-colors hover:bg-neutral-100 active:translate-y-px dark:bg-neutral-800 dark:hover:bg-neutral-700`;

/**
 * Idle/done label pair inside a labeled action button. The
 * `mdxr-copy-idle`/`mdxr-copy-done` classes are client-JS hooks — the
 * document script toggles `.copied` on the parent button to swap them.
 */
export const CopyFeedback = (props: {
  /** Done-state text (e.g. `Copied`, `Saved`). */
  done: string;
  /** Idle-state icon, e.g. `lucide:clipboard-list`. */
  icon: string;
  /** Idle-state text (e.g. `Copy answers`). */
  label: string;
}): ReactElement => (
  <>
    <span className="mdxr-copy-idle inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5" name={props.icon} />
      {props.label}
    </span>
    <span
      className={`mdxr-copy-done hidden items-center gap-1.5 ${TONE_TEXT.emerald}`}
    >
      <Icon className="h-3.5 w-3.5" name="lucide:check" />
      {props.done}
    </span>
  </>
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

const CAPTION_BASE = `${SURFACE_CLS} px-4 py-2 text-xs ${TEXT.muted}`;
const CAPTION_BORDER = `border-b ${BORDER_CLS}`;

/** CaptionBar's strip classes, for headers that are not a `<figcaption>`
 * (Ask's section header). */
export const CAPTION_CLS = `${CAPTION_BORDER} ${CAPTION_BASE}`;

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

/** PANEL_CLS + row dividers — the bordered container for row-style lists. */
const LIST_CLS = `divide-y divide-neutral-200 dark:divide-neutral-800 ${PANEL_CLS}`;

/**
 * Bordered `divide-y` container for row-style lists (Deps, Files, Tests…).
 * `as` picks the semantic tag; figures are the default because captioned
 * lists pair this with `CaptionBar` (a figcaption). `title` renders that
 * caption — only sensible on the default figure.
 */
export const ListPanel = (props: {
  as?: "div" | "dl" | "figure" | "section";
  children?: ReactNode;
  className?: string;
  /** Plain-text list title rendered as a `CaptionBar`. */
  title?: string;
}): ReactElement => {
  const Tag = props.as ?? "figure";
  return (
    <Tag className={`${LIST_CLS} ${props.className ?? ""}`}>
      {nonEmpty(props.title) ? (
        <CaptionBar border={false} className="font-medium">
          {props.title}
        </CaptionBar>
      ) : null}
      {props.children}
    </Tag>
  );
};

/**
 * Truncated name + optional muted sub-line — the label cell of chart rows
 * (Waterfall spans, Gantt tasks/milestones).
 */
export const RowLabel = (props: {
  name: ReactNode;
  /** Faint second line (`owner · note`); empty/absent hides it. */
  sub?: string;
}): ReactElement => (
  <div className="min-w-0">
    <div className="truncate text-sm">{props.name}</div>
    {nonEmpty(props.sub) ? (
      <div className={`truncate ${TEXT_SUB} ${TEXT.faint}`}>{props.sub}</div>
    ) : null}
  </div>
);

/**
 * Rotating disclosure chevron for tree-line `<details>` (Tree, Json).
 * `mdxr-chev` is the CSS hook that spins it open — keep the name.
 */
export const FoldChev = (props: {
  /** Non-conflicting extras, e.g. group-hover colors. */
  className?: string;
}): ReactElement => (
  <Icon
    className={`mdxr-chev h-3 w-3 shrink-0 self-center ${TEXT.faint} ${props.className ?? ""}`}
    name="lucide:chevron-right"
  />
);

/** Muted icon centered on a list row (Files/Deps/Changes/Search). */
export const RowIcon = (props: {
  /** Non-conflicting extras. */
  className?: string;
  /** Iconify name, e.g. `lucide:search`. */
  name: string;
}): ReactElement => (
  <Icon
    className={`h-3.5 w-3.5 shrink-0 self-center ${TEXT.faint} ${props.className ?? ""}`}
    name={props.name}
  />
);

/**
 * Inline kind/status tag — icon + label colored via `className`
 * (e.g. `text-emerald-600 dark:text-emerald-400`); no background, unlike `Pill`.
 */
export const Tag = (props: {
  children?: ReactNode;
  /** Tone/extra classes appended after the tag shape. */
  className?: string;
  /** Iconify name. */
  icon: string;
}): ReactElement => (
  <span
    className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${props.className ?? ""}`}
  >
    <Icon className="h-3.5 w-3.5" name={props.icon} />
    {props.children}
  </span>
);

/** Top-level titled section — the `my-6` wrapper with an optional h3 heading. */
export const Section = (props: {
  children?: ReactNode;
  /** Heading text; empty/absent hides the h3. */
  title?: string;
}): ReactElement => (
  <section className="my-6">
    {nonEmpty(props.title) ? <h3 className="mt-0">{props.title}</h3> : null}
    {props.children}
  </section>
);

/** Small numbered square used by list items indexed via `useChildIndex`. */
export const NumBadge = (props: { n: number }): ReactElement => (
  <span
    className={`flex h-5 w-5 items-center justify-center rounded-md border ${CHIP_BORDER_CLS} font-mono ${TEXT_MICRO} font-medium ${TEXT.faint}`}
  >
    {props.n}
  </span>
);

/**
 * Optional MDX body region — renders nothing without children and trims the
 * outer margins of the first/last child (TRIM_CLS). `className` carries the
 * spacing/text look, e.g. `mt-1.5 text-sm`.
 */
export const TrimBody = (props: {
  children?: ReactNode;
  className?: string;
}): ReactElement | null =>
  props.children === undefined ? null : (
    <div className={`${TRIM_CLS} ${props.className ?? ""}`}>
      {props.children}
    </div>
  );

/**
 * Bordered card for counted list items (Finding, Hypothesis): index badge +
 * a pill slot + optional title + prose children.
 */
export const IndexedCard = (props: {
  /** Right-aligned extra in the header row (e.g. a file LocLink). */
  aside?: ReactNode;
  children?: ReactNode;
  /** 1-based index from `useChildIndex`; 0 hides the badge. */
  n: number;
  /** Status pill (usually `<Pill>`). */
  pill: ReactNode;
  title?: string;
}): ReactElement => (
  <article className={`rounded-lg border px-4 py-3 ${BORDER_CLS}`}>
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {props.n > 0 ? <NumBadge n={props.n} /> : null}
      {props.pill}
      {nonEmpty(props.title) ? (
        <span className="text-sm font-medium">{props.title}</span>
      ) : null}
      {props.aside === undefined ? null : (
        <span className="ml-auto">{props.aside}</span>
      )}
    </div>
    <TrimBody className="mt-1.5 text-sm">{props.children}</TrimBody>
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
    <Section title={props.title}>
      {total > 0 ? (
        <div
          className={`mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${TEXT.muted}`}
        >
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
    </Section>
  );
};

/**
 * File/editor link that may not resolve: renders an `<a>` when `href` is
 * set (with `linkTarget`), else a `<span>` — identical classes either way.
 * Link-only utilities (`hover:underline`, `text-inherit`) are inert on the
 * span, so a single `className` covers both branches.
 */
export const MaybeLink = (props: {
  children?: ReactNode;
  className?: string;
  href?: string;
}): ReactElement =>
  props.href === undefined ? (
    <span className={props.className}>{props.children}</span>
  ) : (
    <a
      className={props.className}
      href={props.href}
      {...linkTarget(props.href)}
    >
      {props.children}
    </a>
  );

/**
 * Trailing note slot inside a `ListRow` — the muted free-text annotation at
 * the end of a row (Files/Deps/Changes/…). Renders nothing without children.
 */
export const RowNote = (props: {
  children?: ReactNode;
  /** Non-conflicting extras, e.g. margin-trimming `[&>*]:…` selectors. */
  className?: string;
}): ReactElement | null =>
  props.children === undefined ? null : (
    <span
      className={`min-w-0 flex-1 text-sm ${TEXT.muted} ${props.className ?? ""}`}
    >
      {props.children}
    </span>
  );

/**
 * Bordered inline chip shell shared by the reference components —
 * FileRef/SymbolRef/Cmd (via CodeChip), Ref's link chip, Graph's standalone
 * node chip. `font-mono` stays with the callers that want mono content.
 */
export const CODE_CHIP_CLS = `not-prose mx-0.5 inline-flex items-center gap-1.5 rounded-md border ${CHIP_BORDER_CLS} bg-neutral-100 px-1.5 py-0.5 align-baseline text-[0.85em] ${TEXT.code} dark:bg-neutral-800`;

/** Bordered inline code chip — the `<code>` shell used by FileRef/SymbolRef/Cmd. */
export const CodeChip = (props: { children?: ReactNode }): ReactElement => (
  <code className={`font-mono ${CODE_CHIP_CLS}`}>{props.children}</code>
);

/** `path` plus its `:lines` suffix — the file-location label. */
export const PathLabel = (props: {
  lines?: string;
  /** Classes for the `:{lines}` suffix (e.g. `opacity-60`); plain text otherwise. */
  linesClassName?: string;
  path: string;
}): ReactElement => {
  const suffix = nonEmpty(props.lines) ? `:${props.lines}` : "";
  return (
    <>
      {props.path}
      {props.linesClassName === undefined || suffix === "" ? (
        suffix
      ) : (
        <span className={props.linesClassName}>{suffix}</span>
      )}
    </>
  );
};

/**
 * File-location link: `path:lines` in muted mono, linked to the editor when
 * the path resolves (`useFileLink`). The standard companion of `FlowStep`,
 * `TraceFrame`, `Test` rows.
 */
export const LocLink = (props: {
  /** Overrides the muted-mono look. */
  className?: string;
  /** Explicit link override (the `href` catalog prop). */
  href?: string;
  lines?: string;
  path: string;
}): ReactElement => {
  const link = useFileLink(props.path, props.lines, props.href);
  return (
    <MaybeLink
      className={props.className ?? `${LOC_CLS} no-underline hover:underline`}
      href={link}
    >
      <PathLabel lines={props.lines} path={props.path} />
    </MaybeLink>
  );
};

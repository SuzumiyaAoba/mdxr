import * as v from "valibot";

import { defineComponent } from "../define.js";
import { words } from "../extended/data.js";
import { safeHref } from "../guards.js";
import { DataPanel } from "./data-view.js";

export const Sources = defineComponent(
  {
    description:
      "Numbered bibliography. Source ids are resolved by Cite anywhere in the document.",
    schema: v.looseObject({
      id: v.optional(v.string()),
      title: v.optional(v.string(), "Sources"),
    }),
  },
  ({ children, title, id }) => (
    <DataPanel title={title} id={id}>
      <div className="space-y-3 p-4">{children}</div>
    </DataPanel>
  )
);
export const Source = defineComponent(
  {
    description:
      "Bibliography entry with title, URL, author, publication/access dates and citation backlinks.",
    schema: v.looseObject({
      accessed: v.optional(v.string()),
      author: v.optional(v.string()),
      backlinks: v.optional(v.string()),
      href: v.string(),
      id: v.string(),
      number: v.optional(v.string()),
      published: v.optional(v.string()),
      title: v.string(),
    }),
  },
  ({
    id,
    title,
    href,
    author,
    published,
    accessed,
    number,
    backlinks,
    children,
  }) => (
    <div className="text-sm" id={id}>
      <span className="mr-2 font-mono">[{number ?? id}]</span>
      <a
        className="font-medium text-sky-700 underline dark:text-sky-300"
        href={safeHref(href)}
      >
        {title}
      </a>
      <span className="ml-2 text-neutral-500">
        {[
          author,
          published,
          accessed !== undefined && accessed !== ""
            ? `accessed ${accessed}`
            : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
      {children}
      <span className="ml-2">
        {words(backlinks).map((backlink, i) => (
          <a
            key={backlink}
            href={`#${backlink}`}
            className="mr-2 underline"
            aria-label={`Back to citation ${i + 1}`}
          >
            ↩{i + 1}
          </a>
        ))}
      </span>
    </div>
  )
);
export const Cite = defineComponent(
  {
    description:
      "Inline citation by source id; numbering and backlinks are generated at compile time.",
    schema: v.looseObject({
      href: v.optional(v.string()),
      id: v.optional(v.string()),
      label: v.optional(v.string()),
      source: v.string(),
    }),
  },
  ({ source, label, href, id }) => (
    <sup id={id}>
      <a
        className="text-sky-700 underline dark:text-sky-300"
        href={safeHref(href ?? `#${source}`)}
      >
        {label ?? source}
      </a>
    </sup>
  )
);
export const CrossRef = defineComponent(
  {
    description:
      "Reference a figure, table, equation, requirement or any component id; missing ids are render errors.",
    schema: v.looseObject({
      href: v.optional(v.string()),
      label: v.optional(v.string()),
      target: v.string(),
    }),
  },
  ({ target, href, label, children }) => (
    <a
      className="text-sky-700 underline dark:text-sky-300"
      href={safeHref(href ?? `#${target}`)}
    >
      {children ?? label ?? target}
    </a>
  )
);
export const TermRef = defineComponent(
  {
    description: "Glossary reference with an accessible definition and link.",
    schema: v.looseObject({
      description: v.optional(v.string()),
      href: v.optional(v.string()),
      label: v.optional(v.string()),
      target: v.optional(v.string()),
      term: v.optional(v.string()),
    }),
  },
  ({ term, href, label, description }) => (
    <span className="inline-flex items-baseline gap-1">
      <a
        href={safeHref(href ?? "#")}
        title={description}
        className="underline decoration-dotted"
      >
        {label ?? term}
      </a>
      {description !== undefined && description !== "" ? (
        <span className="sr-only">: {description}</span>
      ) : null}
    </span>
  )
);
export const Sidenote = defineComponent(
  {
    description:
      "Responsive side note, floated in wide documents and inline on narrow screens.",
    schema: v.looseObject({
      id: v.optional(v.string()),
      title: v.optional(v.string()),
    }),
  },
  ({ title, id, children }) => (
    <aside
      id={id}
      aria-label={title ?? "Side note"}
      className="my-3 border-l-2 border-sky-400 bg-sky-50 p-3 text-sm md:float-right md:ml-6 md:w-64 dark:bg-sky-950"
    >
      {title !== undefined && title !== "" ? <strong>{title}</strong> : null}
      {children}
    </aside>
  )
);
export const Include = defineComponent(
  {
    description:
      "Compile-time Markdown/MDX inclusion, relative paths rebased; optional heading section; cycles and executable MDX are rejected.",
    schema: v.looseObject({
      path: v.string(),
      section: v.optional(v.string()),
    }),
  },
  ({ children }) => <div className="contents">{children}</div>
);
export const TableOfFigures = defineComponent(
  {
    description:
      "Generated list of numbered objects; kind is Figure, DataTable, NumberedEquation or Theorem.",
    schema: v.looseObject({
      kind: v.optional(v.string(), "Figure"),
      title: v.optional(v.string(), "List of figures"),
    }),
  },
  ({ title, children }) => (
    <nav
      aria-label={title}
      className="my-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
    >
      <strong>{title}</strong>
      {children}
    </nav>
  )
);
export const NumberedEquation = defineComponent(
  {
    description:
      "Numbered equation block; put a Markdown math block inside and reference its id using CrossRef.",
    schema: v.looseObject({
      id: v.optional(v.string()),
      number: v.optional(v.string()),
    }),
  },
  ({ id, number, children }) => (
    <figure
      id={id}
      className="my-5 flex items-center justify-between gap-4 overflow-x-auto"
    >
      <div className="min-w-0 flex-1">{children}</div>
      <figcaption>({number})</figcaption>
    </figure>
  )
);
export const Theorem = defineComponent(
  {
    description: "Numbered theorem statement with a cross-referenceable id.",
    schema: v.looseObject({
      id: v.optional(v.string()),
      number: v.optional(v.string()),
      title: v.optional(v.string()),
    }),
  },
  ({ id, number, title, children }) => (
    <DataPanel
      title={`Theorem ${number ?? ""}${title !== undefined && title !== "" ? ` · ${title}` : ""}`}
      id={id}
    >
      <div className="p-4 italic">{children}</div>
    </DataPanel>
  )
);
export const Proof = defineComponent(
  {
    description: "Expandable proof with a referenceable id.",
    schema: v.looseObject({
      id: v.optional(v.string()),
      title: v.optional(v.string(), "Proof"),
    }),
  },
  ({ id, title, children }) => (
    <details
      id={id}
      className="my-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
    >
      <summary className="cursor-pointer font-semibold">{title}</summary>
      {children}
      <p className="text-right" aria-label="End of proof">
        ∎
      </p>
    </details>
  )
);

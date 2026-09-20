import { defineComponent, v } from "@suzumiyaaoba/mdxr";
import { Icon, StatusBadge, STATUSES } from "@suzumiyaaoba/mdxr/components";
import { useState } from "react";

export const LinkCard = defineComponent(
  {
    description: "External reference card linking to a doc, issue, or PR",
    schema: v.looseObject({
      href: v.string(),
      title: v.string(),
    }),
  },
  ({ href, title, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="not-prose my-2 block rounded-lg border border-neutral-200 p-3 no-underline transition-colors hover:border-indigo-400 dark:border-neutral-800 dark:hover:border-indigo-600"
    >
      <div className="font-medium text-indigo-600 dark:text-indigo-400">
        {title} ↗
      </div>
      {children === undefined ? null : (
        <div className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
          {children}
        </div>
      )}
    </a>
  )
);

export const FeatureCard = defineComponent(
  {
    description:
      "Feature summary card — composes the built-in <Icon> and <StatusBadge>",
    schema: v.looseObject({
      icon: v.optional(v.string()),
      status: v.optional(v.picklist(STATUSES), "todo"),
      title: v.string(),
    }),
  },
  ({ title, icon, status, children }) => (
    <div className="not-prose my-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center gap-2">
        {icon === undefined ? null : (
          <Icon
            className="h-4 w-4 text-neutral-500 dark:text-neutral-400"
            name={icon}
          />
        )}
        <span className="font-medium">{title}</span>
        <span className="ml-auto">
          <StatusBadge status={status} />
        </span>
      </div>
      {children === undefined ? null : (
        <div className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
          {children}
        </div>
      )}
    </div>
  )
);

const COUNTER_BUTTON =
  "flex h-6 w-6 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100";

export const Counter = defineComponent(
  {
    description:
      "Interactive counter — project components hydrate, so useState keeps working in the rendered HTML",
    schema: v.looseObject({
      label: v.optional(v.string()),
      start: v.optional(v.string()),
    }),
  },
  ({ label, start }) => {
    const [count, setCount] = useState(Number(start ?? "0") || 0);
    return (
      <span className="not-prose my-2 inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-2 py-1.5 dark:border-neutral-800">
        <button
          aria-label="Decrement"
          className={COUNTER_BUTTON}
          onClick={() => {
            setCount((c) => c - 1);
          }}
          type="button"
        >
          <Icon className="h-3.5 w-3.5" name="lucide:minus" />
        </button>
        <span className="min-w-6 text-center font-mono text-sm tabular-nums">
          {count}
        </span>
        <button
          aria-label="Increment"
          className={COUNTER_BUTTON}
          onClick={() => {
            setCount((c) => c + 1);
          }}
          type="button"
        >
          <Icon className="h-3.5 w-3.5" name="lucide:plus" />
        </button>
        {label === undefined ? null : (
          <span className="pr-1 text-xs text-neutral-400 dark:text-neutral-500">
            {label}
          </span>
        )}
      </span>
    );
  }
);

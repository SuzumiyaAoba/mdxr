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
        <StatusBadge status={status} />
      </div>
      {children === undefined ? null : (
        <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {children}
        </div>
      )}
    </div>
  )
);

export const Counter = defineComponent(
  {
    description: "Hydrated counter — proves client interactivity",
    schema: v.looseObject({
      label: v.optional(v.string(), "count"),
      start: v.optional(v.string(), "0"),
    }),
  },
  ({ label, start }) => {
    const [n, setN] = useState(Number(start));
    return (
      <button
        type="button"
        onClick={() => {
          setN(n + 1);
        }}
        className="not-prose my-1 rounded-md border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700"
      >
        {label}: {n} (+1)
      </button>
    );
  }
);

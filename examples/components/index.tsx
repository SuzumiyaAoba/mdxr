import { defineComponent, v } from "mdxr";

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

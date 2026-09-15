import { defineComponent, v } from "@suzumiyaaoba/rv";
import { StatusBadge } from "@suzumiyaaoba/rv/components";

export const Timeline = defineComponent(
  {
    description: "Chronological event list",
    schema: v.looseObject({ title: v.optional(v.string()) }),
  },
  ({ title, children }) => (
    <section className="my-6">
      {title !== undefined && title !== "" ? (
        <h3 className="mt-0">{title}</h3>
      ) : null}
      <div className="space-y-4 border-l-2 border-indigo-300 pl-4 dark:border-indigo-800">
        {children}
      </div>
    </section>
  )
);

export const Event = defineComponent(
  {
    description: "A single timeline entry",
    schema: v.looseObject({
      date: v.string(),
      status: v.optional(v.string()),
    }),
  },
  ({ date, status, children }) => (
    <div className="relative">
      <span className="absolute top-1.5 -left-[1.42rem] h-2.5 w-2.5 rounded-full bg-indigo-500" />
      <div className="flex items-baseline gap-2">
        <time className="font-mono text-xs text-neutral-500">{date}</time>
        {status !== undefined && status !== "" ? (
          <StatusBadge status={status} />
        ) : null}
      </div>
      <div className="[&>*:first-child]:mt-1 [&>*:last-child]:mb-0">
        {children}
      </div>
    </div>
  )
);

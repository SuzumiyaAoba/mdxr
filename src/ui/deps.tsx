import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { Icon } from "./icon.js";

export const DEP_KINDS = [
  "calls",
  "extends",
  "implements",
  "imports",
  "reads",
  "writes",
] as const;
export type DepKind = (typeof DEP_KINDS)[number];

const KINDS: Record<DepKind, { cls: string; icon: string }> = {
  calls: {
    cls: "text-sky-600 dark:text-sky-400",
    icon: "lucide:square-function",
  },
  extends: {
    cls: "text-violet-600 dark:text-violet-400",
    icon: "lucide:git-branch",
  },
  implements: {
    cls: "text-teal-600 dark:text-teal-400",
    icon: "lucide:layers",
  },
  imports: {
    cls: "text-neutral-500 dark:text-neutral-400",
    icon: "lucide:package",
  },
  reads: {
    cls: "text-neutral-500 dark:text-neutral-400",
    icon: "lucide:eye",
  },
  writes: {
    cls: "text-amber-600 dark:text-amber-400",
    icon: "lucide:pencil",
  },
};

export const Deps = defineComponent(
  {
    description:
      "依存関係エッジ一覧のコンテナ。<Dep> を並べる。title でキャプションバー",
    schema: v.looseObject({
      title: v.optional(v.string()),
    }),
  },
  ({ title, children }) => (
    <figure className="not-prose my-4 divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {nonEmpty(title) ? (
        <figcaption className="bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
          {title}
        </figcaption>
      ) : null}
      {children}
    </figure>
  )
);

export const Dep = defineComponent(
  {
    description:
      "依存エッジ1行。from → to。kind は imports|calls|extends|implements|reads|writes。children は注記",
    schema: v.looseObject({
      from: v.string(),
      kind: v.optional(v.picklist(DEP_KINDS), "imports"),
      to: v.string(),
    }),
  },
  ({ from, to, kind, children }) => {
    const k = KINDS[kind];
    return (
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-2.5">
        <code className="font-mono text-[0.85em] text-neutral-800 dark:text-neutral-200">
          {from}
        </code>
        <Icon
          className="h-3.5 w-3.5 shrink-0 self-center text-neutral-400 dark:text-neutral-500"
          name="lucide:arrow-right"
        />
        <code className="font-mono text-[0.85em] text-neutral-800 dark:text-neutral-200">
          {to}
        </code>
        <span
          className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${k.cls}`}
        >
          <Icon className="h-3.5 w-3.5" name={k.icon} />
          {kind}
        </span>
        {children === undefined ? null : (
          <span className="min-w-0 flex-1 text-sm text-neutral-500 dark:text-neutral-400">
            {children}
          </span>
        )}
      </div>
    );
  }
);

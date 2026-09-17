import { isValidElement } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { isRecord, nonEmpty } from "../guards.js";
import { indexChildren, useChildIndex } from "./child-index.js";
import { Icon } from "./icon.js";

export const HYPOTHESIS_STATUSES = [
  "supported",
  "refuted",
  "untested",
] as const;
export type HypothesisStatus = (typeof HYPOTHESIS_STATUSES)[number];

export const isHypothesisStatus = (x: unknown): x is HypothesisStatus =>
  typeof x === "string" &&
  (HYPOTHESIS_STATUSES as readonly string[]).includes(x);

const STYLES: Record<
  HypothesisStatus,
  { cls: string; icon: string; label: string }
> = {
  refuted: {
    cls: "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
    icon: "lucide:circle-x",
    label: "Refuted",
  },
  supported: {
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    icon: "lucide:circle-check",
    label: "Supported",
  },
  untested: {
    cls: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
    icon: "lucide:flask-conical",
    label: "Untested",
  },
};

export const Hypothesis = defineComponent(
  {
    description:
      "検証対象の仮説。status は supported|refuted|untested（支持された/棄却された/未検証）。title と children（検証内容・証拠）",
    schema: v.looseObject({
      status: v.optional(v.picklist(HYPOTHESIS_STATUSES), "untested"),
      title: v.optional(v.string()),
    }),
  },
  ({ status, title, children }) => {
    const { n } = useChildIndex();
    const s = STYLES[status];
    return (
      <article className="rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {n > 0 ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-md border border-neutral-300 font-mono text-[0.7em] font-medium text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
              {n}
            </span>
          ) : null}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}
          >
            <Icon className="h-3 w-3" name={s.icon} />
            {s.label}
          </span>
          {nonEmpty(title) ? (
            <span className="text-sm font-medium">{title}</span>
          ) : null}
        </div>
        {children === undefined ? null : (
          <div className="mt-1.5 text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {children}
          </div>
        )}
      </article>
    );
  }
);

export const Hypotheses = defineComponent(
  {
    description:
      "仮説リストのコンテナ。<Hypothesis> を並べ、status 別の件数サマリを上部に表示",
    schema: v.looseObject({
      title: v.optional(v.string()),
    }),
  },
  ({ title, children }) => {
    const counts = new Map<HypothesisStatus, number>();
    let total = 0;
    for (const node of flattenChildren(children)) {
      if (!isValidElement(node) || node.type !== Hypothesis) {
        continue;
      }
      const status = isRecord(node.props) ? node.props.status : undefined;
      const s = isHypothesisStatus(status) ? status : "untested";
      counts.set(s, (counts.get(s) ?? 0) + 1);
      total += 1;
    }
    return (
      <section className="my-6">
        {nonEmpty(title) ? <h3 className="mt-0">{title}</h3> : null}
        {total > 0 ? (
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
            <span>
              {total} hypothes{total === 1 ? "is" : "es"}
            </span>
            {HYPOTHESIS_STATUSES.map((s) => {
              const count = counts.get(s);
              return count === undefined ? null : (
                <span key={s}>
                  · {count} {STYLES[s].label.toLowerCase()}
                </span>
              );
            })}
          </div>
        ) : null}
        <div className="not-prose space-y-3">{indexChildren(children)}</div>
      </section>
    );
  }
);

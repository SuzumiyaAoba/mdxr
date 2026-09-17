import { isValidElement } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { isRecord, nonEmpty } from "../guards.js";
import { indexChildren, useChildIndex } from "./child-index.js";
import { Icon } from "./icon.js";

export const CONFIDENCES = ["confirmed", "inferred", "unverified"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const isConfidence = (x: unknown): x is Confidence =>
  typeof x === "string" && (CONFIDENCES as readonly string[]).includes(x);

const CONF: Record<Confidence, { cls: string; icon: string; label: string }> = {
  confirmed: {
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
    icon: "lucide:badge-check",
    label: "Confirmed",
  },
  inferred: {
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
    icon: "lucide:lightbulb",
    label: "Inferred",
  },
  unverified: {
    cls: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
    icon: "lucide:circle-dashed",
    label: "Unverified",
  },
};

export const Finding = defineComponent(
  {
    description:
      "調査の発見事項。confidence は confirmed|inferred|unverified（確証済み/推論/未検証）。title と children（根拠・証拠）",
    schema: v.looseObject({
      confidence: v.optional(v.picklist(CONFIDENCES), "confirmed"),
      title: v.optional(v.string()),
    }),
  },
  ({ confidence, title, children }) => {
    const { n } = useChildIndex();
    const c = CONF[confidence];
    return (
      <article className="rounded-lg border border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {n > 0 ? (
            <span className="flex h-5 w-5 items-center justify-center rounded-md border border-neutral-300 font-mono text-[0.7em] font-medium text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
              {n}
            </span>
          ) : null}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.cls}`}
          >
            <Icon className="h-3 w-3" name={c.icon} />
            {c.label}
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

export const Findings = defineComponent(
  {
    description:
      "発見事項リストのコンテナ。<Finding> を並べ、confidence 別の件数サマリを上部に表示",
    schema: v.looseObject({
      title: v.optional(v.string()),
    }),
  },
  ({ title, children }) => {
    const counts = new Map<Confidence, number>();
    let total = 0;
    for (const node of flattenChildren(children)) {
      if (!isValidElement(node) || node.type !== Finding) {
        continue;
      }
      const conf = isRecord(node.props) ? node.props.confidence : undefined;
      const c = isConfidence(conf) ? conf : "confirmed";
      counts.set(c, (counts.get(c) ?? 0) + 1);
      total += 1;
    }
    return (
      <section className="my-6">
        {nonEmpty(title) ? <h3 className="mt-0">{title}</h3> : null}
        {total > 0 ? (
          <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
            <span>
              {total} finding{total === 1 ? "" : "s"}
            </span>
            {CONFIDENCES.map((c) => {
              const count = counts.get(c);
              return count === undefined ? null : (
                <span key={c}>
                  · {count} {CONF[c].label.toLowerCase()}
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

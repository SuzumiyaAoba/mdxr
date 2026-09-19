import type { ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { isOneOf, nonEmpty } from "../guards.js";
import { LINK_LINES_PROPS } from "./attrs.js";
import { IndexedCard, LocLink, Pill, Section } from "./bits.js";
import { indexChildren, useChildIndex } from "./child-index.js";
import { isEl, propOf } from "./children.js";
import {
  SEVERITY_LEVELS,
  SEVERITY_STYLES,
  Severity,
  isSeverity,
} from "./severity.js";
import { TONE, TEXT } from "./tones.js";

export const REVIEW_VERDICTS = ["approve", "comment", "changes"] as const;
export type ReviewVerdict = (typeof REVIEW_VERDICTS)[number];

const VERDICT_STYLES: Record<
  ReviewVerdict,
  { cls: string; icon: string; label: string }
> = {
  approve: {
    cls: TONE.emerald,
    icon: "lucide:circle-check-big",
    label: "Approved",
  },
  changes: {
    cls: TONE.amber,
    icon: "lucide:message-square-warning",
    label: "Changes requested",
  },
  comment: {
    cls: TONE.sky,
    icon: "lucide:message-square-text",
    label: "Commented",
  },
};

export const Comment = defineComponent(
  {
    description:
      "レビュー指摘1件。severity は critical|high|medium|low|info、file/lines でコード位置へのエディタリンク。children は説明や修正案 (```diff フェンスで提案 diff も書ける)",
    schema: v.looseObject({
      ...LINK_LINES_PROPS,
      file: v.optional(v.string()),
      severity: v.optional(v.picklist(SEVERITY_LEVELS), "info"),
      title: v.optional(v.string()),
    }),
  },
  ({ severity, title, file, lines, href, children }) => {
    const { n } = useChildIndex();
    return (
      <IndexedCard
        aside={
          nonEmpty(file) ? (
            <LocLink href={href} lines={lines} path={file} />
          ) : undefined
        }
        n={n}
        pill={<Severity level={severity} />}
        title={title}
      >
        {children}
      </IndexedCard>
    );
  }
);

/** Tally `severity` across <Comment> children for the summary line. */
const countComments = (children: ReactNode): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const node of flattenChildren(children)) {
    if (!isEl(node, Comment)) {
      continue;
    }
    const sev = propOf(node, "severity");
    const key = isSeverity(sev) ? sev : "info";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

const isReviewVerdict = isOneOf(REVIEW_VERDICTS);

export const Review = defineComponent(
  {
    description:
      "コードレビュー結果のコンテナ。<Comment> を列挙し、severity 別の件数を上部に集計。verdict は approve|comment|changes の判定ピル",
    schema: v.looseObject({
      title: v.optional(v.string()),
      verdict: v.optional(v.picklist(REVIEW_VERDICTS)),
    }),
  },
  ({ title, verdict, children }) => {
    const counts = countComments(children);
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const style = isReviewVerdict(verdict)
      ? VERDICT_STYLES[verdict]
      : undefined;
    return (
      <Section title={title}>
        {total > 0 || style !== undefined ? (
          <div
            className={`mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${TEXT.muted}`}
          >
            {style === undefined ? null : (
              <Pill className={style.cls} icon={style.icon}>
                {style.label}
              </Pill>
            )}
            {total > 0 ? (
              <span>
                {total} {total === 1 ? "comment" : "comments"}
              </span>
            ) : null}
            {SEVERITY_LEVELS.map((k) => {
              const count = counts.get(k);
              return count === undefined ? null : (
                <span key={k}>
                  · {count} {SEVERITY_STYLES[k].label.toLowerCase()}
                </span>
              );
            })}
          </div>
        ) : null}
        <div className="not-prose space-y-3">{indexChildren(children)}</div>
      </Section>
    );
  }
);

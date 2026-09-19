import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { isOneOf, nonEmpty, safeHref } from "../guards.js";
import { attrTrue, BOOLISH_PROP, NUMISH } from "./attrs.js";
import { CaptionBar, ListPanel, MaybeLink, TrimBody } from "./bits.js";
import { isEl, propOf } from "./children.js";
import { Icon } from "./icon.js";
import { formatDuration, parseDuration } from "./tests.js";
import {
  CHIP_BORDER_CLS,
  COUNT_CHIP_CLS,
  LOC_CLS,
  MINI_CHIP_CLS,
  SUNKEN_CLS,
  TEXT,
  TONE,
  TONE_TEXT,
} from "./tones.js";

export const CHECK_STATUSES = [
  "pass",
  "fail",
  "running",
  "pending",
  "skip",
] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

const isCheckStatus = isOneOf(CHECK_STATUSES);

const STYLES: Record<
  CheckStatus,
  { cls: string; icon: string; label: string }
> = {
  fail: {
    cls: TONE_TEXT.red,
    icon: "lucide:circle-x",
    label: "failed",
  },
  pass: {
    cls: TONE_TEXT.emerald,
    icon: "lucide:circle-check",
    label: "passed",
  },
  pending: {
    cls: TONE_TEXT.neutral,
    icon: "lucide:circle-dashed",
    label: "pending",
  },
  running: {
    cls: TONE_TEXT.sky,
    icon: "lucide:loader-circle",
    label: "running",
  },
  skip: {
    cls: TONE_TEXT.neutral,
    icon: "lucide:circle-minus",
    label: "skipped",
  },
};

export const Check = defineComponent(
  {
    description:
      "CI チェック1行。name は必須、status は pass|fail|running|pending|skip。duration、required で必須チェックチップ、href で詳細リンク。children はログ抜粋などの詳細",
    schema: v.looseObject({
      duration: v.optional(NUMISH),
      href: v.optional(v.string()),
      name: v.string(),
      required: BOOLISH_PROP,
      status: v.optional(v.picklist(CHECK_STATUSES), "pass"),
    }),
  },
  ({ name, status, duration, required, href, children }) => {
    const s = STYLES[status];
    const link = safeHref(href);
    return (
      <div className="px-4 py-2.5">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <Icon
            className={`h-4 w-4 shrink-0 self-center ${s.cls}`}
            label={s.label}
            name={s.icon}
          />
          <MaybeLink
            className="text-sm text-inherit no-underline hover:underline"
            href={link}
          >
            {name}
          </MaybeLink>
          {attrTrue(required) ? (
            <span className={`${MINI_CHIP_CLS} ${TONE.neutral}`}>Required</span>
          ) : null}
          {duration === undefined || duration === "" ? null : (
            <span className={`${LOC_CLS} ml-auto tabular-nums`}>
              {String(duration)}
            </span>
          )}
        </div>
        <TrimBody
          className={`mt-1.5 rounded-md border-l-2 px-3 py-2 text-xs ${TEXT.body} ${
            status === "fail"
              ? "border-red-400/60 bg-red-500/5"
              : `${CHIP_BORDER_CLS} ${SUNKEN_CLS}`
          }`}
        >
          {children}
        </TrimBody>
      </div>
    );
  }
);

interface CheckSummary {
  counts: Map<CheckStatus, number>;
  durationOk: boolean;
  total: number;
  totalMs: number;
}

const summarizeChecks = (children: ReactNode): CheckSummary => {
  const counts = new Map<CheckStatus, number>();
  let totalMs = 0;
  let total = 0;
  let durationOk = true;
  for (const node of flattenChildren(children)) {
    if (!isEl(node, Check)) {
      continue;
    }
    const st = propOf(node, "status");
    const status = isCheckStatus(st) ? st : "pass";
    counts.set(status, (counts.get(status) ?? 0) + 1);
    total += 1;
    const rawDuration = propOf(node, "duration");
    const d = parseDuration(rawDuration);
    if (d !== undefined) {
      totalMs += d;
      continue;
    }
    if (rawDuration !== undefined && rawDuration !== "") {
      durationOk = false;
    }
  }
  return { counts, durationOk, total, totalMs };
};

const ChecksCaption = ({
  context,
  summary,
  title,
}: {
  context: string | undefined;
  summary: CheckSummary;
  title: string | undefined;
}): ReactElement => (
  <CaptionBar className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
    <Icon className="h-3.5 w-3.5" name="lucide:list-checks" />
    <span className="font-medium">{nonEmpty(title) ? title : "Checks"}</span>
    {nonEmpty(context) ? (
      <span className={COUNT_CHIP_CLS}>{context}</span>
    ) : null}
    <span className="ml-auto flex items-center gap-x-2 font-medium">
      {CHECK_STATUSES.map((st) => {
        const c = summary.counts.get(st);
        return c === undefined ? null : (
          <span className={STYLES[st].cls} key={st}>
            {c} {STYLES[st].label}
          </span>
        );
      })}
      {summary.durationOk && summary.totalMs > 0 ? (
        <span className="font-mono tabular-nums">
          {formatDuration(summary.totalMs)}
        </span>
      ) : null}
    </span>
  </CaptionBar>
);

export const Checks = defineComponent(
  {
    description:
      "CI/検証ステータス一覧のコンテナ。<Check> を並べる。title はキャプション、context は対象チップ (commit SHA・PR 番号など)。status 別の件数と合計時間を自動集計",
    schema: v.looseObject({
      context: v.optional(v.string()),
      title: v.optional(v.string()),
    }),
  },
  ({ title, context, children }) => {
    const summary = summarizeChecks(children);
    const caption = nonEmpty(title) || nonEmpty(context) || summary.total > 0;
    return (
      <ListPanel>
        {caption ? (
          <ChecksCaption context={context} summary={summary} title={title} />
        ) : null}
        {children}
      </ListPanel>
    );
  }
);

import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { nonEmpty } from "../guards.js";
import { LINK_LINES_PROPS } from "./attrs.js";
import { CaptionBar, ListPanel, LocLink } from "./bits.js";
import { isEl, propOf } from "./children.js";
import { Icon } from "./icon.js";
import { LOC_CLS, TEXT, TRIM_CLS } from "./tones.js";

export const TEST_STATUSES = ["pass", "fail", "skip", "todo"] as const;
export type TestStatus = (typeof TEST_STATUSES)[number];

const isTestStatus = (x: unknown): x is TestStatus =>
  typeof x === "string" && (TEST_STATUSES as readonly string[]).includes(x);

const STYLES: Record<TestStatus, { cls: string; icon: string; label: string }> =
  {
    fail: {
      cls: "text-red-500",
      icon: "lucide:circle-x",
      label: "failed",
    },
    pass: {
      cls: "text-emerald-500",
      icon: "lucide:circle-check",
      label: "passed",
    },
    skip: {
      cls: "text-neutral-400",
      icon: "lucide:circle-minus",
      label: "skipped",
    },
    todo: {
      cls: "text-violet-500 dark:text-violet-400",
      icon: "lucide:circle-dashed",
      label: "todo",
    },
  };

/** `"120ms"`/`"1.2s"`/`"2m"` → milliseconds; unparseable → undefined. */
const parseDuration = (x: unknown): number | undefined => {
  if (typeof x === "number") {
    return Number.isFinite(x) ? x : undefined;
  }
  if (typeof x !== "string") {
    return undefined;
  }
  const m = /^(?<n>\d+(?:\.\d+)?)\s*(?<u>ms|s|m)?$/u.exec(x.trim());
  if (m?.groups === undefined) {
    return undefined;
  }
  const n = Number(m.groups.n);
  const unit = m.groups.u ?? "ms";
  if (unit === "s") {
    return n * 1000;
  }
  if (unit === "m") {
    return n * 60_000;
  }
  return n;
};

const formatDuration = (ms: number): string => {
  if (ms >= 10_000) {
    return `${Math.round(ms / 1000)}s`;
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.round(ms)}ms`;
};

export const Test = defineComponent(
  {
    description:
      "テスト結果1行。name は必須、status は pass|fail|skip|todo。duration に所要時間、file/lines で実ファイルへのエディタリンク。children は失敗時の詳細 (エラー出力など)",
    schema: v.looseObject({
      ...LINK_LINES_PROPS,
      duration: v.optional(v.union([v.string(), v.number()])),
      file: v.optional(v.string()),
      name: v.string(),
      status: v.optional(v.picklist(TEST_STATUSES), "pass"),
    }),
  },
  ({ name, status, duration, file, lines, href, children }) => {
    const s = STYLES[status];
    return (
      <div className="px-4 py-2.5">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <Icon
            className={`h-4 w-4 shrink-0 self-center ${s.cls}`}
            label={s.label}
            name={s.icon}
          />
          <span className="text-sm">{name}</span>
          {nonEmpty(file) ? (
            <LocLink href={href} lines={lines} path={file} />
          ) : null}
          {duration === undefined || duration === "" ? null : (
            <span className={`${LOC_CLS} ml-auto tabular-nums`}>
              {String(duration)}
            </span>
          )}
        </div>
        {children === undefined ? null : (
          <div
            className={`mt-1.5 rounded-md border-l-2 px-3 py-2 text-xs ${TEXT.body} ${TRIM_CLS} ${
              status === "fail"
                ? "border-red-400/60 bg-red-500/5"
                : "border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/50"
            }`}
          >
            {children}
          </div>
        )}
      </div>
    );
  }
);

interface TestSummary {
  counts: Map<TestStatus, number>;
  /** False when any <Test> carried an unparseable duration — hides the total. */
  durationOk: boolean;
  total: number;
  totalMs: number;
}

/** Aggregates status counts and total duration over <Test> children. */
const summarizeTests = (children: ReactNode): TestSummary => {
  const counts = new Map<TestStatus, number>();
  let totalMs = 0;
  let total = 0;
  let durationOk = true;
  for (const node of flattenChildren(children)) {
    if (!isEl(node, Test)) {
      continue;
    }
    const st = propOf(node, "status");
    const status = isTestStatus(st) ? st : "pass";
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

const TestsCaption = ({
  summary,
  title,
  tool,
}: {
  summary: TestSummary;
  title: string | undefined;
  tool: string | undefined;
}): ReactElement => (
  <CaptionBar className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
    <Icon className="h-3.5 w-3.5" name="lucide:flask-conical" />
    {nonEmpty(title) ? (
      <span className="font-medium">{title}</span>
    ) : (
      <span className="font-medium">Tests</span>
    )}
    {nonEmpty(tool) ? (
      <span className="rounded bg-neutral-200/70 px-1.5 py-px font-mono text-[0.68rem] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
        {tool}
      </span>
    ) : null}
    <span className="ml-auto flex items-center gap-x-2 font-medium">
      {TEST_STATUSES.map((st) => {
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

export const Tests = defineComponent(
  {
    description:
      "テスト実行レポートのコンテナ。<Test> を並べる。title はキャプション、tool はランナー名チップ。status 別の件数と合計時間を自動集計",
    schema: v.looseObject({
      title: v.optional(v.string()),
      tool: v.optional(v.string()),
    }),
  },
  ({ title, tool, children }) => {
    const summary = summarizeTests(children);
    const caption = nonEmpty(title) || nonEmpty(tool) || summary.total > 0;
    return (
      <ListPanel>
        {caption ? (
          <TestsCaption summary={summary} title={title} tool={tool} />
        ) : null}
        {children}
      </ListPanel>
    );
  }
);

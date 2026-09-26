import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { isOneOf, nonEmpty } from "../guards.js";
import { LINK_LINES_PROPS, NUMISH } from "./attrs.js";
import { CaptionBar, ListPanel, LocLink, TrimBody } from "./bits.js";
import { isEl, propOf } from "./children.js";
import { Icon } from "./icon.js";
import {
  CHIP_BORDER_CLS,
  COUNT_CHIP_CLS,
  LOC_CLS,
  SUNKEN_CLS,
  TEXT,
  TONE_TEXT,
} from "./tones.js";

export const TEST_STATUSES = ["pass", "fail", "skip", "todo"] as const;
export type TestStatus = (typeof TEST_STATUSES)[number];

const isTestStatus = isOneOf(TEST_STATUSES);

const STYLES: Record<TestStatus, { cls: string; icon: string; label: string }> =
  {
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
    skip: {
      cls: TONE_TEXT.neutral,
      icon: "lucide:circle-minus",
      label: "skipped",
    },
    todo: {
      cls: TONE_TEXT.violet,
      icon: "lucide:circle-dashed",
      label: "todo",
    },
  };

/** `"120ms"`/`"1.2s"`/`"2m"` → milliseconds; unparseable → undefined. */
export const parseDuration = (x: unknown): number | undefined => {
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
  let duration = Number(m.groups.n);
  const unit = m.groups.u ?? "ms";
  if (unit === "s") {
    duration *= 1000;
  }
  if (unit === "m") {
    duration *= 60_000;
  }
  return Number.isFinite(duration) ? duration : undefined;
};

export const formatDuration = (ms: number): string => {
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
      duration: v.optional(NUMISH),
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
        <TrimBody
          className={`mt-1.5 border-l-2 px-3 py-2 text-xs ${TEXT.body} ${
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
    {nonEmpty(tool) ? <span className={COUNT_CHIP_CLS}>{tool}</span> : null}
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

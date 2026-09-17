import { isValidElement } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { isRecord, nonEmpty } from "../guards.js";
import { linkTarget, useFileLink } from "./file-link.js";
import { Icon } from "./icon.js";

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
      duration: v.optional(v.union([v.string(), v.number()])),
      file: v.optional(v.string()),
      href: v.optional(v.string()),
      lines: v.optional(v.string()),
      name: v.string(),
      status: v.optional(v.picklist(TEST_STATUSES), "pass"),
    }),
  },
  ({ name, status, duration, file, lines, href, children }) => {
    const s = STYLES[status];
    const link = useFileLink(file, lines, href);
    const loc = (
      <>
        {file}
        {nonEmpty(lines) ? `:${lines}` : ""}
      </>
    );
    const locEl =
      link === undefined ? (
        <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500">
          {loc}
        </span>
      ) : (
        <a
          className="font-mono text-xs text-neutral-400 no-underline hover:underline dark:text-neutral-500"
          href={link}
          {...linkTarget(link)}
        >
          {loc}
        </a>
      );
    return (
      <div className="px-4 py-2.5">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <Icon
            className={`h-4 w-4 shrink-0 self-center ${s.cls}`}
            label={s.label}
            name={s.icon}
          />
          <span className="text-sm">{name}</span>
          {nonEmpty(file) ? locEl : null}
          {duration === undefined || duration === "" ? null : (
            <span className="ml-auto font-mono text-xs text-neutral-400 tabular-nums dark:text-neutral-500">
              {String(duration)}
            </span>
          )}
        </div>
        {children === undefined ? null : (
          <div
            className={`mt-1.5 rounded-md border-l-2 px-3 py-2 text-xs text-neutral-600 dark:text-neutral-300 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${
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
    const counts = new Map<TestStatus, number>();
    let totalMs = 0;
    let total = 0;
    let durationOk = true;
    for (const node of flattenChildren(children)) {
      if (!isValidElement(node) || node.type !== Test) {
        continue;
      }
      const props = isRecord(node.props) ? node.props : {};
      const st = isTestStatus(props.status) ? props.status : "pass";
      counts.set(st, (counts.get(st) ?? 0) + 1);
      total += 1;
      const d = parseDuration(props.duration);
      if (d === undefined) {
        if (props.duration !== undefined && props.duration !== "") {
          durationOk = false;
        }
      } else {
        totalMs += d;
      }
    }
    const caption = nonEmpty(title) || nonEmpty(tool) || total > 0;
    return (
      <figure className="not-prose my-6 divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {caption ? (
          <figcaption className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
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
                const c = counts.get(st);
                return c === undefined ? null : (
                  <span className={STYLES[st].cls} key={st}>
                    {c} {STYLES[st].label}
                  </span>
                );
              })}
              {durationOk && totalMs > 0 ? (
                <span className="font-mono tabular-nums">
                  {formatDuration(totalMs)}
                </span>
              ) : null}
            </span>
          </figcaption>
        ) : null}
        {children}
      </figure>
    );
  }
);

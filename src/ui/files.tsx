import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { Icon } from "./icon.js";

export const FILE_KINDS = [
  "config",
  "core",
  "docs",
  "entry",
  "generated",
  "test",
  "types",
] as const;

const KINDS: Record<string, { cls: string; icon: string }> = {
  config: {
    cls: "text-neutral-500 dark:text-neutral-400",
    icon: "lucide:settings",
  },
  core: {
    cls: "text-violet-600 dark:text-violet-400",
    icon: "lucide:layers",
  },
  docs: {
    cls: "text-neutral-500 dark:text-neutral-400",
    icon: "lucide:book-open",
  },
  entry: {
    cls: "text-sky-600 dark:text-sky-400",
    icon: "lucide:log-in",
  },
  generated: {
    cls: "text-neutral-500 dark:text-neutral-400",
    icon: "lucide:bot",
  },
  test: {
    cls: "text-amber-600 dark:text-amber-400",
    icon: "lucide:flask-conical",
  },
  types: {
    cls: "text-teal-600 dark:text-teal-400",
    icon: "lucide:braces",
  },
};

const FALLBACK_KIND = {
  cls: "text-neutral-500 dark:text-neutral-400",
  icon: "lucide:tag",
};

export const Files = defineComponent(
  {
    description:
      "関連ファイル一覧のコンテナ。<File> を並べる。title でキャプションバー",
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

export const File = defineComponent(
  {
    description:
      "関連ファイル1行。path は必須、lines で行範囲を併記。kind は entry|core|types|config|test|docs|generated など（既知の値はアイコン/色付き、それ以外も表示可）。children は役割の注記",
    schema: v.looseObject({
      kind: v.optional(v.string()),
      lines: v.optional(v.string()),
      path: v.string(),
    }),
  },
  ({ path, lines, kind, children }) => {
    const r = nonEmpty(kind) ? (KINDS[kind] ?? FALLBACK_KIND) : undefined;
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
        <Icon
          className="h-3.5 w-3.5 shrink-0 self-center text-neutral-400 dark:text-neutral-500"
          name="lucide:file-code"
        />
        <code className="font-mono text-[0.85em] text-neutral-800 dark:text-neutral-200">
          {path}
          {nonEmpty(lines) ? (
            <span className="text-neutral-400 dark:text-neutral-500">
              :{lines}
            </span>
          ) : null}
        </code>
        {r === undefined ? null : (
          <span
            className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${r.cls}`}
          >
            <Icon className="h-3.5 w-3.5" name={r.icon} />
            {kind}
          </span>
        )}
        {children === undefined ? null : (
          <span className="min-w-0 flex-1 text-sm text-neutral-500 dark:text-neutral-400">
            {children}
          </span>
        )}
      </div>
    );
  }
);

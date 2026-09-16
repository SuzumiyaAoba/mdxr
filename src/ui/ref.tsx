import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { Icon } from "./icon.js";

export const Ref = defineComponent(
  {
    description: "外部参照リンクカード。href/title は必須。children は説明文",
    schema: v.looseObject({
      href: v.string(),
      title: v.string(),
    }),
  },
  ({ href, title, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="not-prose my-3 flex items-start gap-3 rounded-lg border border-neutral-200 p-3 text-inherit no-underline transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
    >
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400"
        name="lucide:external-link"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {title}
        </span>
        {children === undefined ? null : (
          <span className="mt-0.5 block text-sm text-neutral-500 dark:text-neutral-400">
            {children}
          </span>
        )}
      </span>
    </a>
  )
);

const GH_PATH: Record<"commit" | "issue" | "pr", string> = {
  commit: "commit",
  issue: "issues",
  pr: "pull",
};

const ghLink = (
  kind: "issue" | "pr" | "commit",
  repo: string,
  id: string
): string => `https://github.com/${repo}/${GH_PATH[kind]}/${id}`;

const CHIP_CLS =
  "not-prose mx-0.5 inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 align-baseline text-[0.85em] text-neutral-800 no-underline transition-colors hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700";

const refChip = (
  kind: "issue" | "pr",
  repo: string,
  number: string,
  href: string | undefined,
  children: ReactNode
): ReactElement => (
  <a
    href={href ?? ghLink(kind, repo, number)}
    target="_blank"
    rel="noopener noreferrer"
    className={CHIP_CLS}
    title={`${repo}#${number}`}
  >
    <Icon
      className="h-3.5 w-3.5 opacity-60"
      name={kind === "pr" ? "lucide:git-pull-request" : "lucide:circle-dot"}
    />
    <span className="font-mono">#{number}</span>
    {children === undefined ? null : (
      <span className="text-neutral-600 dark:text-neutral-300">{children}</span>
    )}
  </a>
);

const ghRefSchema = () =>
  v.looseObject({
    href: v.optional(v.string()),
    number: v.union([v.string(), v.number()]),
    repo: v.string(),
  });

export const Issue = defineComponent(
  {
    description:
      'GitHub issue 参照チップ。repo="owner/repo" と number は必須。children はタイトル',
    schema: ghRefSchema(),
  },
  ({ repo, number, href, children }) =>
    refChip("issue", repo, String(number), href, children)
);

export const PR = defineComponent(
  {
    description:
      'GitHub pull request 参照チップ。repo="owner/repo" と number は必須。children はタイトル',
    schema: ghRefSchema(),
  },
  ({ repo, number, href, children }) =>
    refChip("pr", repo, String(number), href, children)
);

export const Commit = defineComponent(
  {
    description:
      'GitHub コミット参照チップ。repo="owner/repo" と sha は必須。sha は先頭7文字で表示。children はタイトル',
    schema: v.looseObject({
      href: v.optional(v.string()),
      repo: v.string(),
      sha: v.string(),
    }),
  },
  ({ repo, sha, href, children }) => (
    <a
      href={href ?? ghLink("commit", repo, sha)}
      target="_blank"
      rel="noopener noreferrer"
      className={CHIP_CLS}
      title={`${repo}@${sha}`}
    >
      <Icon
        className="h-3.5 w-3.5 opacity-60"
        name="lucide:git-commit-horizontal"
      />
      <span className="font-mono">{sha.slice(0, 7)}</span>
      {children === undefined ? null : (
        <span className="text-neutral-600 dark:text-neutral-300">
          {children}
        </span>
      )}
    </a>
  )
);

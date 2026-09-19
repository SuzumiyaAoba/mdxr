import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { safeHref } from "../guards.js";
import { NUMISH } from "./attrs.js";
import { Icon } from "./icon.js";
import { BORDER_CLS, TEXT } from "./tones.js";

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
      href={safeHref(href)}
      target="_blank"
      rel="noopener noreferrer"
      className={`group not-prose my-6 flex items-start gap-3 rounded-lg border px-4 py-3 text-inherit no-underline transition-colors hover:bg-neutral-50 active:bg-neutral-100 dark:hover:bg-neutral-900 dark:active:bg-neutral-800 ${BORDER_CLS}`}
    >
      <Icon
        className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        name="lucide:external-link"
      />
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-medium ${TEXT.strong}`}>
          {title}
        </span>
        {children === undefined ? null : (
          <span className={`mt-0.5 block text-sm ${TEXT.muted}`}>
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

/** One repo/host path segment — GitHub names are alnum, `-`, `_`, `.`. */
const REPO_SEG = /^[\w.-]+$/u;

/** `o/r` → github.com; `host/o/r` or a full URL → that host (e.g. GHES). */
const repoBase = (repo: string): string => {
  const r = repo.replace(/\/+$/u, "");
  // A `proto://` value is used verbatim only for web schemes — a
  // `javascript:`/`data:` repo would otherwise land in `href` unchecked.
  if (r.includes("://")) {
    return /^https?:\/\//iu.test(r) ? r : `https://github.com/${r}`;
  }
  // The host/o/r form needs plausible segments — `javascript:alert(1)//x`
  // has no `://` but is no repo either; treating its first piece as a host
  // would mint `https://javascript:…` links. Degrade to a github.com path,
  // which is at worst a broken link, never a scriptable one.
  const segs = r.split("/");
  if (!segs.every((s) => REPO_SEG.test(s))) {
    return `https://github.com/${r}`;
  }
  return segs.length > 2 ? `https://${r}` : `https://github.com/${r}`;
};

const ghLink = (
  kind: "issue" | "pr" | "commit",
  repo: string,
  id: string
): string => `${repoBase(repo)}/${GH_PATH[kind]}/${id}`;

const CHIP_CLS =
  "not-prose mx-0.5 inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 align-baseline text-[0.85em] text-neutral-800 no-underline transition-all hover:bg-neutral-200 active:scale-95 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700";

const refChip = (
  kind: "issue" | "pr",
  repo: string,
  number: string,
  href: string | undefined,
  children: ReactNode
): ReactElement => (
  <a
    href={safeHref(href) ?? ghLink(kind, repo, number)}
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
      <span className={TEXT.body}>{children}</span>
    )}
  </a>
);

const ghRefSchema = () =>
  v.looseObject({
    href: v.optional(v.string()),
    number: NUMISH,
    repo: v.string(),
  });

export const Issue = defineComponent(
  {
    description:
      'GitHub issue 参照チップ。repo="owner/repo"（"host/owner/repo" や URL も可）と number は必須。children はタイトル',
    schema: ghRefSchema(),
  },
  ({ repo, number, href, children }) =>
    refChip("issue", repo, String(number), href, children)
);

export const PR = defineComponent(
  {
    description:
      'GitHub pull request 参照チップ。repo="owner/repo"（"host/owner/repo" や URL も可）と number は必須。children はタイトル',
    schema: ghRefSchema(),
  },
  ({ repo, number, href, children }) =>
    refChip("pr", repo, String(number), href, children)
);

export const Commit = defineComponent(
  {
    description:
      'GitHub コミット参照チップ。repo="owner/repo"（"host/owner/repo" や URL も可）と sha は必須。sha は先頭7文字で表示。children はタイトル',
    schema: v.looseObject({
      href: v.optional(v.string()),
      repo: v.string(),
      sha: v.string(),
    }),
  },
  ({ repo, sha, href, children }) => (
    <a
      href={safeHref(href) ?? ghLink("commit", repo, sha)}
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
        <span className={TEXT.body}>{children}</span>
      )}
    </a>
  )
);

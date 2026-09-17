import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { fileIcon } from "./file-icon.js";
import { linkTarget, useFileLink } from "./file-link.js";
import { Icon } from "./icon.js";

export const CHANGE_KINDS = ["add", "modify", "delete", "rename"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

const KINDS: Record<ChangeKind, { cls: string; icon: string; label: string }> =
  {
    add: {
      cls: "text-emerald-600 dark:text-emerald-400",
      icon: "lucide:file-plus",
      label: "Add",
    },
    delete: {
      cls: "text-red-600 dark:text-red-400",
      icon: "lucide:file-x",
      label: "Delete",
    },
    modify: {
      cls: "text-sky-600 dark:text-sky-400",
      icon: "lucide:file-pen",
      label: "Modify",
    },
    rename: {
      cls: "text-violet-600 dark:text-violet-400",
      icon: "lucide:file-symlink",
      label: "Rename",
    },
  };

export const Changes = defineComponent(
  {
    description: "変更ファイル一覧のコンテナ。<Change> を並べる",
  },
  ({ children }) => (
    <div className="not-prose my-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {children}
    </div>
  )
);

export const Change = defineComponent(
  {
    description:
      "変更ファイル1行。kind は add|modify|delete|rename。rename 時は to に変更後パス。実在ファイルはエディタリンク（既定 vscode://）になり、href で上書き可。children は注記",
    schema: v.looseObject({
      href: v.optional(v.string()),
      kind: v.optional(v.picklist(CHANGE_KINDS), "modify"),
      path: v.string(),
      to: v.optional(v.string()),
    }),
  },
  ({ kind, path, to, href, children }) => {
    const k = KINDS[kind];
    const link = useFileLink(nonEmpty(to) ? to : path, undefined, href);
    const label = (
      <code className="font-mono text-[0.85em] text-neutral-800 dark:text-neutral-200">
        {path}
        {nonEmpty(to) ? (
          <span className="text-neutral-400 dark:text-neutral-500">
            {" → "}
            {to}
          </span>
        ) : null}
      </code>
    );
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
        <span
          className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${k.cls}`}
        >
          <Icon className="h-3.5 w-3.5" name={k.icon} />
          {k.label}
        </span>
        <Icon
          className="h-3.5 w-3.5 shrink-0 self-center text-neutral-400 dark:text-neutral-500"
          name={fileIcon(nonEmpty(to) ? to : path)}
        />
        {link === undefined ? (
          label
        ) : (
          <a
            className="text-inherit no-underline hover:underline"
            href={link}
            {...linkTarget(link)}
          >
            {label}
          </a>
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

import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { FILE_LINK_PROPS } from "./attrs.js";
import { CopyButton } from "./bits.js";
import { fileIcon } from "./file-icon.js";
import { linkTarget, useFileLink } from "./file-link.js";
import { Icon } from "./icon.js";

export const FileRef = defineComponent(
  {
    description:
      'ソースファイルへの参照チップ。lines="10-20" で行範囲を示せる。実在ファイルはエディタリンク（既定 vscode://）になり、href で上書き可。アイコンは拡張子から自動選択',
    schema: v.looseObject({
      ...FILE_LINK_PROPS,
      path: v.string(),
    }),
  },
  ({ path, lines, href }) => {
    const link = useFileLink(path, lines, href);
    const label = (
      <>
        {path}
        {nonEmpty(lines) ? <span className="opacity-60">:{lines}</span> : null}
      </>
    );
    return (
      <code className="not-prose mx-0.5 inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 align-baseline font-mono text-[0.85em] text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
        <Icon className="h-3.5 w-3.5 opacity-60" name={fileIcon(path)} />
        {link === undefined ? (
          <span>{label}</span>
        ) : (
          <a
            className="text-inherit no-underline hover:underline"
            href={link}
            {...linkTarget(link)}
          >
            {label}
          </a>
        )}
        <CopyButton
          className="-mr-0.5 opacity-40"
          copy={path}
          title="Copy path"
        />
      </code>
    );
  }
);

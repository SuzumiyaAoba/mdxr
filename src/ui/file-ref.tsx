import * as v from "valibot";

import { defineComponent } from "../define.js";
import { Icon } from "./icon.js";

export const FileRef = defineComponent(
  {
    description: 'ソースファイルへの参照チップ。lines="10-20" で行範囲を示せる',
    schema: v.looseObject({
      lines: v.optional(v.string()),
      path: v.string(),
    }),
  },
  ({ path, lines }) => (
    <code className="not-prose mx-0.5 inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 align-baseline font-mono text-[0.85em] text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
      <Icon className="h-3.5 w-3.5 opacity-60" name="lucide:file-code" />
      <span>
        {path}
        {lines !== undefined && lines !== "" ? (
          <span className="opacity-60">:{lines}</span>
        ) : null}
      </span>
      <button
        type="button"
        data-copy={path}
        className="rv-copy -mr-0.5 cursor-pointer opacity-40 transition-opacity hover:opacity-100"
        title="Copy path"
        aria-label="Copy path"
      >
        <Icon className="h-3.5 w-3.5" name="lucide:copy" />
      </button>
    </code>
  )
);

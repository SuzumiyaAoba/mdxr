import * as v from "valibot";

import { defineComponent } from "../define.js";

export const FileRef = defineComponent(
  {
    description: 'ソースファイルへの参照チップ。lines="10-20" で行範囲を示せる',
    schema: v.looseObject({
      lines: v.optional(v.string()),
      path: v.string(),
    }),
  },
  ({ path, lines }) => (
    <code className="mx-0.5 inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 align-baseline font-mono text-[0.85em] text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 opacity-60"
        fill="currentColor"
        aria-hidden
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 2 4 4h-4z" />
      </svg>
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
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="currentColor"
          aria-hidden
        >
          <path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11z" />
        </svg>
      </button>
    </code>
  )
);

import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { Icon } from "./icon.js";

export { Choice, Question, QUESTION_TYPES } from "./ask-question.js";
export type { QuestionType } from "./ask-question.js";

/**
 * A block of questions asking the reader for input — e.g. open decisions in
 * a plan. Built on native form controls so it is interactive in static HTML.
 * Answers are rendered live as a Markdown sheet (`- **label**: answer` lines
 * under `# title`) in the output pane; "Copy answers" copies it to the
 * clipboard and "Save .md" downloads it (nothing is submitted anywhere).
 * `Choice`/`Question` and the per-type field chrome live in
 * `ask-question.tsx`.
 */
export const Ask = defineComponent(
  {
    description:
      "ユーザーへの質問フォーム。<Question> を並べる。ネイティブコントロールで JS なしに操作可能。回答はラベル付きの Markdown として表示され、「Copy answers」でコピー、「Save .md」で保存できる",
    schema: v.looseObject({
      description: v.optional(v.string()),
      title: v.optional(v.string()),
    }),
  },
  ({ title, description, children }) => (
    <section
      className="mdxr-ask not-prose my-6 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
      data-ask
      data-ask-title={nonEmpty(title) ? title : undefined}
    >
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          <Icon className="h-3.5 w-3.5" name="lucide:list-checks" />
          {nonEmpty(title) ? title : "Questions"}
        </div>
        {nonEmpty(description) ? (
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {description}
          </p>
        ) : null}
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
        {children}
      </div>
      <div className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-1.5 px-4 pt-2.5 text-xs font-medium text-neutral-400 dark:text-neutral-500">
          <Icon className="h-3 w-3" name="lucide:file-text" />
          Markdown
        </div>
        <pre
          className="m-0 max-h-64 overflow-auto px-4 pt-1 pb-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-neutral-600 dark:text-neutral-300"
          data-ask-output
        >
          (answers appear here as Markdown)
        </pre>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-800 dark:bg-neutral-900">
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          Updates live as you answer — copy or save it.
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className="inline-flex cursor-pointer items-center rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition-all hover:bg-neutral-100 active:translate-y-px dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            data-ask-copy
            type="button"
          >
            <span className="mdxr-copy-idle inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" name="lucide:clipboard-list" />
              Copy answers
            </span>
            <span className="mdxr-copy-done hidden items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Icon className="h-3.5 w-3.5" name="lucide:check" />
              Copied
            </span>
          </button>
          <button
            className="inline-flex cursor-pointer items-center rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition-all hover:bg-neutral-100 active:translate-y-px dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            data-ask-save
            type="button"
          >
            <span className="mdxr-copy-idle inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" name="lucide:download" />
              Save .md
            </span>
            <span className="mdxr-copy-done hidden items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Icon className="h-3.5 w-3.5" name="lucide:check" />
              Saved
            </span>
          </button>
        </div>
      </div>
    </section>
  )
);

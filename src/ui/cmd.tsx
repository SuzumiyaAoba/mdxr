import * as v from "valibot";

import { defineComponent, textOf } from "../define.js";
import { Icon } from "./icon.js";

export const Cmd = defineComponent(
  {
    description:
      "コマンドチップ。ターミナルアイコン + 等幅 + コピーボタン付き。rollout 手順などに",
    schema: v.looseObject({}),
  },
  ({ children }) => (
    <code className="not-prose mx-0.5 inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 align-baseline font-mono text-[0.85em] text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
      <Icon
        className="h-3.5 w-3.5 shrink-0 opacity-60"
        name="lucide:terminal"
      />
      <span>{children}</span>
      <button
        type="button"
        data-copy={textOf(children)}
        className="rv-copy -mr-0.5 cursor-pointer opacity-40"
        title="Copy command"
        aria-label="Copy command"
      >
        <span className="rv-copy-idle inline-flex">
          <Icon className="h-3.5 w-3.5" name="lucide:copy" />
        </span>
        <span className="rv-copy-done hidden items-center text-emerald-600 dark:text-emerald-400">
          <Icon className="h-3.5 w-3.5" name="lucide:check" />
        </span>
      </button>
    </code>
  )
);

import * as v from "valibot";

import { defineComponent, textOf } from "../define.js";
import { CopyButton } from "./bits.js";
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
      <CopyButton
        className="-mr-0.5 opacity-40"
        copy={textOf(children)}
        title="Copy command"
      />
    </code>
  )
);

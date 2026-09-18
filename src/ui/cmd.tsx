import * as v from "valibot";

import { defineComponent, textOf } from "../define.js";
import { CodeChip, CopyButton } from "./bits.js";
import { Icon } from "./icon.js";

export const Cmd = defineComponent(
  {
    description:
      "コマンドチップ。ターミナルアイコン + 等幅 + コピーボタン付き。rollout 手順などに",
    schema: v.looseObject({}),
  },
  ({ children }) => (
    <CodeChip>
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
    </CodeChip>
  )
);

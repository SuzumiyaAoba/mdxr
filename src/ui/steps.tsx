import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { attrTrue, BOOLISH_PROP } from "./attrs.js";
import { isEl, propOf } from "./children.js";
import { CHIP_PROPS, ChipRow } from "./chips.js";
import { Icon } from "./icon.js";
import {
  isStatus,
  STATUS_ICON_CLS,
  STATUS_ICONS,
  STATUSES,
} from "./status-badge.js";
import type { Status } from "./status-badge.js";
import { Summary } from "./summary.js";
import { TRIM_CLS } from "./tones.js";

export const Step = defineComponent(
  {
    description:
      "単一の手順。status は todo|doing|done|blocked。owner/effort/priority/due でチップを付けられる",
    schema: v.looseObject({
      ...CHIP_PROPS,
      status: v.optional(v.picklist(STATUSES), "todo"),
    }),
  },
  ({ status, owner, effort, priority, due, children }) => (
    <div className="flex gap-3">
      <Icon
        className={`mt-1 h-4.5 w-4.5 shrink-0 ${STATUS_ICON_CLS[status]}`}
        label={status}
        name={STATUS_ICONS[status]}
      />
      <div className="min-w-0 flex-1">
        <div className={TRIM_CLS}>{children}</div>
        <ChipRow due={due} effort={effort} owner={owner} priority={priority} />
      </div>
    </div>
  )
);

/** Resolve a child's effective status — only `<Step>` elements count. */
const stepStatus = (node: unknown): Status | undefined => {
  if (!isEl(node, Step)) {
    return undefined;
  }
  const s = propOf(node, "status");
  return isStatus(s) ? s : "todo";
};

export const Steps = defineComponent(
  {
    description:
      "手順リストのコンテナ。<Step> を並べる。progress で自動進捗バーを表示",
    schema: v.looseObject({
      progress: BOOLISH_PROP,
    }),
  },
  ({ progress, children }) => {
    const show = attrTrue(progress);
    const items = flattenChildren(children)
      .map((node) => stepStatus(node))
      .filter((s): s is Status => s !== undefined);
    const done = items.filter((s) => s === "done").length;
    return (
      <div className="my-6 space-y-3">
        {show && items.length > 0 ? (
          <Summary done={done} label="Steps" total={items.length} />
        ) : null}
        {children}
      </div>
    );
  }
);

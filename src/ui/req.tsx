import * as v from "valibot";

import { defineComponent } from "../define.js";
import { ListPanel, ListRow } from "./bits.js";
import { Icon } from "./icon.js";
import { STATUSES, StatusBadge } from "./status-badge.js";
import { TRIM_CLS } from "./tones.js";

export const Reqs = defineComponent(
  {
    description: "要件/受け入れ基準リストのコンテナ。<Req> を並べる",
  },
  ({ children }) => <ListPanel as="div">{children}</ListPanel>
);

export const Req = defineComponent(
  {
    description:
      '要件1行。id="REQ-1" などの識別子チップ。status (todo|doing|done|blocked) でバッジを付けられる',
    schema: v.looseObject({
      id: v.union([v.string(), v.number()]),
      status: v.optional(v.picklist(STATUSES)),
    }),
  },
  ({ id, status, children }) => (
    <ListRow>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
        <Icon className="h-3 w-3 opacity-60" name="lucide:bookmark" />
        {id}
      </span>
      <span className={`min-w-0 flex-1 text-sm ${TRIM_CLS}`}>{children}</span>
      {status === undefined ? null : (
        <span className="ml-auto">
          <StatusBadge status={status} />
        </span>
      )}
    </ListRow>
  )
);

import * as v from "valibot";

import { defineComponent } from "../define.js";
import { NUMISH } from "./attrs.js";
import { ListPanel, ListRow } from "./bits.js";
import { Icon } from "./icon.js";
import { STATUS_PROP, StatusBadge } from "./status-badge.js";
import { TONE, TRIM_CLS } from "./tones.js";

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
      id: NUMISH,
      status: STATUS_PROP,
    }),
  },
  ({ id, status, children }) => (
    <ListRow>
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-medium ${TONE.neutral}`}
      >
        <Icon className="h-3 w-3" name="lucide:bookmark" />
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

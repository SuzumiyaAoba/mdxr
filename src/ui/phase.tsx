import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { Due } from "./due.js";
import { Owner } from "./owner.js";
import { STATUSES, StatusBadge } from "./status-badge.js";
import { BORDER_CLS } from "./tones.js";

export const Phase = defineComponent(
  {
    description:
      "計画のフェーズ見出し。`:::phase` からも生成される。owner/due で担当・期限を示せる",
    schema: v.looseObject({
      due: v.optional(v.string()),
      owner: v.optional(v.string()),
      status: v.optional(v.picklist(STATUSES)),
      title: v.string(),
    }),
  },
  ({ title, status, owner, due, children }) => {
    const hasChips = status !== undefined || nonEmpty(owner) || nonEmpty(due);
    return (
      <section className="my-10">
        <h2
          className={`mt-0 flex flex-wrap items-center gap-3 border-b pb-2 ${BORDER_CLS}`}
        >
          {title}
          {hasChips ? (
            <span className="inline-flex items-center gap-2">
              {status === undefined ? null : <StatusBadge status={status} />}
              {nonEmpty(owner) ? <Owner name={owner} /> : null}
              {nonEmpty(due) ? <Due date={due} /> : null}
            </span>
          ) : null}
        </h2>
        {children}
      </section>
    );
  }
);

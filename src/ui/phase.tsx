import * as v from "valibot";

import { defineComponent } from "../define.js";
import { STATUSES, StatusBadge } from "./status-badge.js";

export const Phase = defineComponent(
  {
    description: "計画のフェーズ見出し。`:::phase` からも生成される",
    schema: v.looseObject({
      status: v.optional(v.picklist(STATUSES)),
      title: v.string(),
    }),
  },
  ({ title, status, children }) => (
    <section className="my-8">
      <h2 className="mt-0 flex items-center gap-3 border-b border-neutral-200 pb-2 dark:border-neutral-800">
        {title}
        {status ? <StatusBadge status={status as string} /> : null}
      </h2>
      {children}
    </section>
  )
);

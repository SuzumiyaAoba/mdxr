import * as v from "valibot";

import { defineComponent } from "../define.js";
import { STATUSES, StatusBadge } from "./status-badge.js";

export const Plan = defineComponent(
  {
    description: "ドキュメントのルート要素。title/status のヘッダを描画する",
    schema: v.looseObject({
      status: v.optional(v.picklist(STATUSES)),
      title: v.optional(v.string()),
    }),
  },
  ({ title, status, children }) => (
    <article>
      {title !== undefined || status !== undefined ? (
        <header className="mb-8 border-b border-neutral-200 pb-4 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            {title === undefined ? null : <h1 className="m-0">{title}</h1>}
            {status === undefined ? null : <StatusBadge status={status} />}
          </div>
        </header>
      ) : null}
      {children}
    </article>
  )
);

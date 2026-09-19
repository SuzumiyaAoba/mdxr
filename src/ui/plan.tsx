import type { ReactElement } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { Meta } from "./meta.js";
import { STATUS_PROP, StatusBadge } from "./status-badge.js";
import { BORDER_CLS } from "./tones.js";

interface PlanHeaderProps {
  date?: string | undefined;
  owner?: string | undefined;
  status?: string | undefined;
  title?: string | undefined;
  updated?: string | undefined;
  version?: string | undefined;
}

const hasMeta = (p: PlanHeaderProps): boolean =>
  [p.date, p.owner, p.version, p.updated].some(nonEmpty);

/**
 * The document header row shared by `<Plan>` and the frontmatter-generated
 * header in render.ts. `status` is validated by StatusBadge's own schema.
 */
export const PlanHeader = (p: PlanHeaderProps): ReactElement => (
  <header className={`mb-8 border-b pb-4 ${BORDER_CLS}`}>
    <div className="flex flex-wrap items-center gap-3">
      {nonEmpty(p.title) ? <h1 className="m-0">{p.title}</h1> : null}
      {nonEmpty(p.status) ? <StatusBadge status={p.status} /> : null}
    </div>
    {hasMeta(p) ? (
      <Meta
        date={p.date}
        owner={p.owner}
        updated={p.updated}
        version={p.version}
      />
    ) : null}
  </header>
);

export const Plan = defineComponent(
  {
    description:
      "ドキュメントのルート要素。title/status/date/owner/version/updated のヘッダを描画する",
    schema: v.looseObject({
      date: v.optional(v.string()),
      owner: v.optional(v.string()),
      status: STATUS_PROP,
      title: v.optional(v.string()),
      updated: v.optional(v.string()),
      version: v.optional(v.string()),
    }),
  },
  ({ title, status, date, owner, version, updated, children }) => {
    const showHeader =
      nonEmpty(title) ||
      nonEmpty(status) ||
      [date, owner, version, updated].some(nonEmpty);
    return (
      <article>
        {showHeader ? (
          <PlanHeader
            date={date}
            owner={owner}
            status={status}
            title={title}
            updated={updated}
            version={version}
          />
        ) : null}
        {children}
      </article>
    );
  }
);

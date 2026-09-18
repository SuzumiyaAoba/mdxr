import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { ListPanel, ListRow, Pill, RowNote } from "./bits.js";
import { Owner } from "./owner.js";
import { LOC_CLS, TONE } from "./tones.js";

export const APPROVAL_STATUSES = [
  "approved",
  "changes-requested",
  "pending",
  "rejected",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

const STYLES: Record<
  ApprovalStatus,
  { cls: string; icon: string; label: string }
> = {
  approved: {
    cls: TONE.emerald,
    icon: "lucide:check",
    label: "Approved",
  },
  "changes-requested": {
    cls: TONE.amber,
    icon: "lucide:message-square-warning",
    label: "Changes requested",
  },
  pending: {
    cls: TONE.neutral,
    icon: "lucide:clock",
    label: "Pending",
  },
  rejected: {
    cls: TONE.red,
    icon: "lucide:x",
    label: "Rejected",
  },
};

export const Approvals = defineComponent(
  {
    description: "承認/レビュー一覧のコンテナ。<Approval> を並べる",
  },
  ({ children }) => <ListPanel as="div">{children}</ListPanel>
);

export const Approval = defineComponent(
  {
    description:
      "承認者1行。name は必須。status は pending|approved|rejected|changes-requested",
    schema: v.looseObject({
      date: v.optional(v.string()),
      name: v.string(),
      role: v.optional(v.string()),
      status: v.optional(v.picklist(APPROVAL_STATUSES), "pending"),
    }),
  },
  ({ name, role, status, date, children }) => {
    const s = STYLES[status];
    return (
      <ListRow align="center">
        <Owner name={name} role={role} />
        <RowNote>{children}</RowNote>
        <span className="ml-auto flex items-baseline gap-2">
          {nonEmpty(date) ? <time className={LOC_CLS}>{date}</time> : null}
          <Pill className={s.cls} icon={s.icon}>
            {s.label}
          </Pill>
        </span>
      </ListRow>
    );
  }
);

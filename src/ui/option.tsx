import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { Pill, TrimBody } from "./bits.js";
import { BORDER_CLS, TONE } from "./tones.js";

export const OPTION_STATUSES = [
  "considered",
  "recommended",
  "rejected",
] as const;
export type OptionStatus = (typeof OPTION_STATUSES)[number];

const STYLES: Record<
  OptionStatus,
  { card: string; chip: string; icon: string; label: string }
> = {
  considered: {
    card: BORDER_CLS,
    chip: TONE.neutral,
    icon: "lucide:minus",
    label: "Considered",
  },
  recommended: {
    card: "border-emerald-300 dark:border-emerald-800",
    chip: TONE.emerald,
    icon: "lucide:thumbs-up",
    label: "Recommended",
  },
  rejected: {
    card: `${BORDER_CLS} opacity-70`,
    chip: TONE.red,
    icon: "lucide:thumbs-down",
    label: "Rejected",
  },
};

export const Option = defineComponent(
  {
    description:
      "検討した選択肢カード。status は recommended|considered|rejected。<Columns> と組み合わせて並べる",
    schema: v.looseObject({
      status: v.optional(v.picklist(OPTION_STATUSES), "considered"),
      title: v.optional(v.string()),
    }),
  },
  ({ title, status, children }) => {
    const s = STYLES[status];
    return (
      <div className={`my-6 rounded-lg border p-4 ${s.card}`}>
        <div className="flex flex-wrap items-center gap-2">
          {nonEmpty(title) ? (
            <span className="font-semibold">{title}</span>
          ) : null}
          <Pill className={s.chip} icon={s.icon}>
            {s.label}
          </Pill>
        </div>
        <TrimBody className="mt-1.5 text-sm">{children}</TrimBody>
      </div>
    );
  }
);

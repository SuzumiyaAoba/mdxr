import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { Pill, TrimBody } from "./bits.js";
import { TONE } from "./tones.js";

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

const STYLES: Record<
  RiskLevel,
  { border: string; chip: string; icon: string; label: string }
> = {
  high: {
    border: "border-red-500",
    chip: TONE.red,
    icon: "lucide:flame",
    label: "High",
  },
  low: {
    border: "border-neutral-400",
    chip: TONE.neutral,
    icon: "lucide:shield",
    label: "Low",
  },
  medium: {
    border: "border-amber-500",
    chip: TONE.amber,
    icon: "lucide:shield-alert",
    label: "Medium",
  },
};

export const Risk = defineComponent(
  {
    description:
      "リスクブロック。level は low|medium|high。mitigation 属性で緩和策を示せる",
    schema: v.looseObject({
      level: v.optional(v.picklist(RISK_LEVELS), "medium"),
      mitigation: v.optional(v.string()),
      title: v.optional(v.string()),
    }),
  },
  ({ level, title, mitigation, children }) => {
    const s = STYLES[level];
    return (
      <aside
        className={`my-6 rounded-r-lg border-l-4 bg-neutral-50 px-4 py-3 text-sm dark:bg-neutral-900/60 ${s.border}`}
      >
        <div className="flex flex-wrap items-baseline gap-2">
          <Pill className={s.chip} icon={s.icon}>
            {s.label} risk
          </Pill>
          {nonEmpty(title) ? (
            <span className="font-semibold">{title}</span>
          ) : null}
        </div>
        <TrimBody className="mt-1.5">{children}</TrimBody>
        {nonEmpty(mitigation) ? (
          <div className="mt-2 border-t border-neutral-200 pt-2 text-xs dark:border-neutral-700">
            <span className="font-medium">Mitigation: </span>
            {mitigation}
          </div>
        ) : null}
      </aside>
    );
  }
);

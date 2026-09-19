import * as v from "valibot";

import { defineComponent } from "../define.js";
import { isOneOf } from "../guards.js";
import { Pill } from "./bits.js";
import { TONE } from "./tones.js";

export const SEVERITY_LEVELS = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

export const isSeverity = isOneOf(SEVERITY_LEVELS);

/** Optional `severity` schema entry — shared by Comment, Vuln and Incident. */
export const SEVERITY_PROP = v.optional(v.picklist(SEVERITY_LEVELS), "medium");

export const SEVERITY_STYLES: Record<
  SeverityLevel,
  { chip: string; icon: string; label: string }
> = {
  critical: {
    chip: TONE.red,
    icon: "lucide:siren",
    label: "Critical",
  },
  high: {
    chip: TONE.orange,
    icon: "lucide:flame",
    label: "High",
  },
  info: {
    chip: TONE.neutral,
    icon: "lucide:info",
    label: "Info",
  },
  low: {
    chip: TONE.sky,
    icon: "lucide:circle-minus",
    label: "Low",
  },
  medium: {
    chip: TONE.amber,
    icon: "lucide:triangle-alert",
    label: "Medium",
  },
};

export const Severity = defineComponent(
  {
    description:
      "重要度ピル。level は critical|high|medium|low|info。レビュー指摘・脆弱性・インシデントの深刻度を示すインラインチップ",
    schema: v.looseObject({
      level: v.optional(v.picklist(SEVERITY_LEVELS), "medium"),
    }),
  },
  ({ level, children }) => {
    const s = SEVERITY_STYLES[level];
    return (
      <Pill className={s.chip} icon={s.icon}>
        {children ?? s.label}
      </Pill>
    );
  }
);

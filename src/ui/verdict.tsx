import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { Pill, TrimBody } from "./bits.js";
import { Icon } from "./icon.js";
import { EDGE_PANEL_CLS, TONE, TONE_BAND } from "./tones.js";

export const VERDICTS = ["approve", "pass", "warn", "fail", "info"] as const;
export type VerdictStatus = (typeof VERDICTS)[number];

const STYLES: Record<
  VerdictStatus,
  { band: string; border: string; chip: string; icon: string; label: string }
> = {
  approve: {
    band: TONE_BAND.emerald,
    border: "border-emerald-500",
    chip: TONE.emerald,
    icon: "lucide:circle-check-big",
    label: "Approved",
  },
  fail: {
    band: TONE_BAND.red,
    border: "border-red-500",
    chip: TONE.red,
    icon: "lucide:circle-x",
    label: "Failed",
  },
  info: {
    band: TONE_BAND.sky,
    border: "border-sky-500",
    chip: TONE.sky,
    icon: "lucide:info",
    label: "Note",
  },
  pass: {
    band: TONE_BAND.emerald,
    border: "border-emerald-500",
    chip: TONE.emerald,
    icon: "lucide:circle-check",
    label: "Passed",
  },
  warn: {
    band: TONE_BAND.amber,
    border: "border-amber-500",
    chip: TONE.amber,
    icon: "lucide:triangle-alert",
    label: "Warning",
  },
};

export const Verdict = defineComponent(
  {
    description:
      "判定バナー。status は approve|pass|warn|fail|info。レビューの合否・移行可否・検証結果の結論を目立つ帯で示す。label で表示文字を上書き可",
    schema: v.looseObject({
      label: v.optional(v.string()),
      status: v.optional(v.picklist(VERDICTS), "info"),
      title: v.optional(v.string()),
    }),
  },
  ({ status, title, label, children }) => {
    const s = STYLES[status];
    return (
      <aside className={`${EDGE_PANEL_CLS} ${s.band} ${s.border}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Icon className="h-4 w-4" label={s.label} name={s.icon} />
          <Pill className={s.chip}>{nonEmpty(label) ? label : s.label}</Pill>
          {nonEmpty(title) ? (
            <span className="font-semibold">{title}</span>
          ) : null}
        </div>
        <TrimBody className="mt-1.5">{children}</TrimBody>
      </aside>
    );
  }
);

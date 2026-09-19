import type { ReactElement } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { isOneOf, nonEmpty } from "../guards.js";
import { Panel, Pill, TrimBody } from "./bits.js";
import { Icon } from "./icon.js";
import { SEVERITY_LEVELS, Severity } from "./severity.js";
import { BORDER_CLS, TEXT, TEXT_SUB, TONE, TONE_TEXT } from "./tones.js";

export const INCIDENT_STATUSES = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

const isIncidentStatus = isOneOf(INCIDENT_STATUSES);

const INCIDENT_STYLES: Record<
  IncidentStatus,
  { cls: string; icon: string; label: string }
> = {
  identified: {
    cls: TONE.amber,
    icon: "lucide:crosshair",
    label: "Identified",
  },
  investigating: {
    cls: TONE.orange,
    icon: "lucide:search",
    label: "Investigating",
  },
  monitoring: {
    cls: TONE.sky,
    icon: "lucide:activity",
    label: "Monitoring",
  },
  resolved: {
    cls: TONE.emerald,
    icon: "lucide:circle-check",
    label: "Resolved",
  },
};

const MetaRow = (props: {
  label: string;
  value: string | undefined;
}): ReactElement | null =>
  nonEmpty(props.value) ? (
    <div className="flex items-baseline gap-2">
      <span className={`w-20 shrink-0 ${TEXT_SUB} ${TEXT.faint}`}>
        {props.label}
      </span>
      <span className="text-sm">{props.value}</span>
    </div>
  ) : null;

export const Incident = defineComponent(
  {
    description:
      "インシデント/ポストモーテムのヘッダブロック。title は必須、severity (critical|high|medium|low|info) と status (investigating|identified|monitoring|resolved) のピル、started/detected/resolved/duration/impact をメタ行に表示。children は概要文",
    schema: v.looseObject({
      detected: v.optional(v.string()),
      duration: v.optional(v.string()),
      impact: v.optional(v.string()),
      resolved: v.optional(v.string()),
      severity: v.optional(v.picklist(SEVERITY_LEVELS)),
      started: v.optional(v.string()),
      status: v.optional(v.picklist(INCIDENT_STATUSES)),
      title: v.string(),
    }),
  },
  ({
    title,
    severity,
    status,
    started,
    detected,
    resolved,
    duration,
    impact,
    children,
  }) => {
    const st = isIncidentStatus(status) ? INCIDENT_STYLES[status] : undefined;
    const meta = [
      ["Started", started],
      ["Detected", detected],
      ["Resolved", resolved],
      ["Duration", duration],
    ] as const;
    const hasMeta = meta.some(([, val]) => nonEmpty(val)) || nonEmpty(impact);
    return (
      <Panel className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {severity === undefined ? null : <Severity level={severity} />}
          {st === undefined ? null : (
            <Pill className={st.cls} icon={st.icon}>
              {st.label}
            </Pill>
          )}
          <span className="font-semibold">{title}</span>
        </div>
        {hasMeta ? (
          <div className={`mt-2 space-y-1 border-t pt-2 ${BORDER_CLS}`}>
            {meta.map(([label, val]) => (
              <MetaRow key={label} label={label} value={val} />
            ))}
            {nonEmpty(impact) ? (
              <div className="flex items-baseline gap-2">
                <span className={`w-20 shrink-0 ${TEXT_SUB} ${TEXT.faint}`}>
                  Impact
                </span>
                <span className={`text-sm font-medium ${TONE_TEXT.red}`}>
                  <Icon
                    className="mr-1 inline h-3.5 w-3.5 align-[-2px]"
                    name="lucide:zap"
                  />
                  {impact}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
        <TrimBody className="mt-2 text-sm">{children}</TrimBody>
      </Panel>
    );
  }
);

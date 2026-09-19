import type { ReactElement } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { isOneOf, nonEmpty } from "../guards.js";
import { NUMISH } from "./attrs.js";
import {
  CaptionBar,
  ListPanel,
  ListRow,
  Panel,
  Pill,
  RowNote,
} from "./bits.js";
import { isEl, propOf } from "./children.js";
import { Icon } from "./icon.js";
import {
  CAPTION_TITLE_CLS,
  LOC_CLS,
  MONO_NUM_CLS,
  TEXT,
  TEXT_SUB,
  TONE,
  TRIM_CLS,
} from "./tones.js";

export const SERVICE_STATUSES = [
  "operational",
  "degraded",
  "outage",
  "maintenance",
] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

const isServiceStatus = isOneOf(SERVICE_STATUSES);

const SERVICE_STYLES: Record<
  ServiceStatus,
  { cls: string; dot: string; icon: string; label: string }
> = {
  degraded: {
    cls: TONE.amber,
    dot: "bg-amber-500",
    icon: "lucide:triangle-alert",
    label: "Degraded",
  },
  maintenance: {
    cls: TONE.sky,
    dot: "bg-sky-500",
    icon: "lucide:wrench",
    label: "Maintenance",
  },
  operational: {
    cls: TONE.emerald,
    dot: "bg-emerald-500",
    icon: "lucide:circle-check",
    label: "Operational",
  },
  outage: {
    cls: TONE.red,
    dot: "bg-red-500",
    icon: "lucide:circle-x",
    label: "Outage",
  },
};

/** Worst status across services → the page-level rollup. */
const rollup = (statuses: readonly ServiceStatus[]): ServiceStatus => {
  if (statuses.includes("outage")) {
    return "outage";
  }
  if (statuses.includes("degraded")) {
    return "degraded";
  }
  if (statuses.includes("maintenance")) {
    return "maintenance";
  }
  return "operational";
};

export const Service = defineComponent(
  {
    description:
      'サービス稼働状況1行。name は必須、status は operational|degraded|outage|maintenance、uptime に稼働率 ("99.98%")。children は補足 (影響内容など)',
    schema: v.looseObject({
      name: v.string(),
      status: v.optional(v.picklist(SERVICE_STATUSES), "operational"),
      uptime: v.optional(NUMISH),
    }),
  },
  ({ name, status, uptime, children }) => {
    const s = SERVICE_STYLES[status];
    return (
      <ListRow>
        <span
          aria-hidden
          className={`h-2.5 w-2.5 shrink-0 self-center rounded-full ${s.dot}`}
        />
        <span className="text-sm font-medium">{name}</span>
        <Pill className={s.cls} icon={s.icon}>
          {s.label}
        </Pill>
        {uptime === undefined || uptime === "" ? null : (
          <span className={`${LOC_CLS} ml-auto tabular-nums`}>
            {String(uptime)}
          </span>
        )}
        <RowNote className={TRIM_CLS}>{children}</RowNote>
      </ListRow>
    );
  }
);

export const StatusPage = defineComponent(
  {
    description:
      "サービスステータス一覧のコンテナ。<Service> を並べ、最悪ステータスをロールアップ表示 (全稼働/一部障害/停止)。title はキャプション",
    schema: v.looseObject({
      title: v.optional(v.string()),
      updated: v.optional(v.string()),
    }),
  },
  ({ title, updated, children }) => {
    const statuses: ServiceStatus[] = [];
    for (const node of flattenChildren(children)) {
      if (!isEl(node, Service)) {
        continue;
      }
      const st = propOf(node, "status");
      statuses.push(isServiceStatus(st) ? st : "operational");
    }
    const overall = rollup(statuses);
    const o = SERVICE_STYLES[overall];
    return (
      <ListPanel>
        <CaptionBar className={CAPTION_TITLE_CLS}>
          <Icon className="h-3.5 w-3.5" name="lucide:activity" />
          {nonEmpty(title) ? title : "Status"}
          <span className="ml-auto flex items-center gap-x-2">
            {nonEmpty(updated) ? (
              <span className={`${TEXT_SUB} font-normal ${TEXT.faint}`}>
                {updated}
              </span>
            ) : null}
            {statuses.length > 0 ? (
              <Pill className={o.cls} icon={o.icon}>
                {overall === "operational"
                  ? "All systems operational"
                  : o.label}
              </Pill>
            ) : null}
          </span>
        </CaptionBar>
        {children}
      </ListPanel>
    );
  }
);

export const DAY_STATUSES = [
  "up",
  "degraded",
  "down",
  "maint",
  "none",
] as const;
export type DayStatus = (typeof DAY_STATUSES)[number];

const DAY_CLS: Record<DayStatus, string> = {
  degraded: "bg-amber-400 dark:bg-amber-500",
  down: "bg-red-500",
  maint: "bg-sky-400 dark:bg-sky-500",
  none: "bg-neutral-200 dark:bg-neutral-700",
  up: "bg-emerald-500",
};

const DAY_LABEL: Record<DayStatus, string> = {
  degraded: "degraded",
  down: "down",
  maint: "maintenance",
  none: "no data",
  up: "operational",
};

export const Day = defineComponent(
  {
    description:
      "稼働バー1セル。status は up|degraded|down|maint|none。date/note はツールチップ。<Uptime> 内に並べる",
    schema: v.looseObject({
      date: v.optional(v.string()),
      note: v.optional(v.string()),
      status: v.optional(v.picklist(DAY_STATUSES), "up"),
    }),
  },
  ({ status, date, note }) => {
    const tip = [date, DAY_LABEL[status], note].filter(nonEmpty).join(" — ");
    return (
      <span
        className={`inline-block h-6 w-1.5 shrink-0 rounded-sm ${DAY_CLS[status]}`}
        title={nonEmpty(tip) ? tip : DAY_LABEL[status]}
      />
    );
  }
);

export const Uptime = defineComponent(
  {
    description:
      "稼働率バー (ステータスページ風)。<Day> セルを日付順に並べる。title はラベル、pct は稼働率表示、from/to で期間の端ラベル",
    schema: v.looseObject({
      from: v.optional(v.string()),
      pct: v.optional(NUMISH),
      title: v.optional(v.string()),
      to: v.optional(v.string()),
    }),
  },
  ({ title, pct, from, to, children }): ReactElement => (
    <Panel className="px-4 py-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-medium">
          {nonEmpty(title) ? title : "Uptime"}
        </span>
        {pct === undefined || pct === "" ? null : (
          <span className={`ml-auto ${MONO_NUM_CLS} text-sm ${TEXT.muted}`}>
            {String(pct)}%
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-0.5">{children}</div>
      {nonEmpty(from) || nonEmpty(to) ? (
        <div className={`mt-2 flex justify-between ${TEXT_SUB} ${TEXT.faint}`}>
          <span>{from ?? ""}</span>
          <span>{to ?? ""}</span>
        </div>
      ) : null}
    </Panel>
  )
);

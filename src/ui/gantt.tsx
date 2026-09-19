import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  format,
  isValid,
  parseISO,
} from "date-fns";
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { DocContext } from "../doc-context.js";
import { nonEmpty } from "../guards.js";
import { attrFalse, NUMISH, numOf } from "./attrs.js";
import { CaptionBar, Panel, RowLabel } from "./bits.js";
import { isEl, propOf } from "./children.js";
import { Icon } from "./icon.js";
import { STATUS_PROP } from "./status-badge.js";
import type { Status } from "./status-badge.js";
import { CAPTION_TITLE_CLS, MONO_NUM_CLS, TEXT } from "./tones.js";

/**
 * Date-based Gantt chart — task bars and milestone diamonds on a day scale.
 * `start`/`end` accept ISO dates (`YYYY-MM-DD`); the range defaults to the
 * earliest task start through the latest task end. A "today" marker is drawn
 * at `DocContext.now` when it falls inside the range.
 */

const ROW_GRID =
  "grid grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)_5rem] items-center gap-x-3";

const TRACK_CLS =
  "relative h-4.5 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-800";

/** Bar fill per status — `soft` backs the progress overlay, `solid` is the bar. */
const BAR: Record<Status, { soft: string; solid: string }> = {
  blocked: { soft: "bg-red-500/30", solid: "bg-red-500" },
  doing: { soft: "bg-sky-500/30", solid: "bg-sky-500" },
  done: { soft: "bg-emerald-500/30", solid: "bg-emerald-500" },
  todo: { soft: "bg-neutral-400/40", solid: "bg-neutral-400" },
};
const DEFAULT_BAR = { soft: "bg-sky-500/30", solid: "bg-sky-500" };
const DEFAULT_MILESTONE = "bg-amber-500";

const toDate = (x: unknown): Date | undefined => {
  if (typeof x !== "string" || x === "") {
    return undefined;
  }
  const d = parseISO(x);
  return isValid(d) ? d : undefined;
};

interface GanttScale {
  /** Range day 0 — day offsets are calendar days from here. */
  origin: Date;
  /** Inclusive range end day (for the caption label). */
  last: Date;
  /** Inclusive day span of the range (>= 1). */
  spanDays: number;
  /** Header/gridline ticks as percents of the range. */
  ticks: { label: string; pct: number }[];
  /** Percent position of the "today" marker, when shown. */
  todayPct?: number;
}

const ScaleCtx = createContext<GanttScale | undefined>(undefined);

const pctOf = (d: Date, scale: GanttScale): number =>
  (differenceInCalendarDays(d, scale.origin) / scale.spanDays) * 100;

const clampPct = (pct: number): number => Math.min(100, Math.max(0, pct));

/** `Sep 1–10` / `Sep 1–Oct 5` / `Sep 1` — the compact range in the right column. */
const fmtRange = (s: Date, e: Date): string => {
  if (differenceInCalendarDays(e, s) === 0) {
    return format(s, "MMM d");
  }
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${format(s, "MMM d")}–${format(e, "d")}`;
  }
  return `${format(s, "MMM d")}–${format(e, "MMM d")}`;
};

const MAX_TICKS = 8;

const tickLabel = (d: Date, monthly: boolean, sparse: boolean): string => {
  if (!monthly) {
    return format(d, "MMM d");
  }
  return sparse || d.getMonth() === 0
    ? format(d, "MMM ''yy")
    : format(d, "MMM");
};

/** Axis ticks: days on short ranges, Mondays mid-range, month starts after. */
const ticksOf = (
  origin: Date,
  last: Date,
  spanDays: number
): { label: string; pct: number }[] => {
  const monthly = spanDays > 70;
  const bounds = { end: last, start: origin };
  let days: Date[];
  if (monthly) {
    days = eachMonthOfInterval(bounds);
  } else if (spanDays > 16) {
    days = eachWeekOfInterval(bounds, { weekStartsOn: 1 });
  } else {
    days = eachDayOfInterval(bounds);
  }
  const ticks = days
    .map((d) => ({
      d,
      pct: (differenceInCalendarDays(d, origin) / spanDays) * 100,
    }))
    // The track edges already mark 0%/100% — drop labels on the boundary.
    .filter((t) => t.pct > 2 && t.pct < 98);
  const stride = Math.max(1, Math.ceil(ticks.length / MAX_TICKS));
  return ticks
    .filter((_, i) => i % stride === 0)
    .map((t) => ({
      label: tickLabel(t.d, monthly, stride > 1),
      pct: t.pct,
    }));
};

/** Tick lines + today marker shared by every row's track (aligned by width). */
const Guides = (): ReactNode => {
  const scale = useContext(ScaleCtx);
  if (scale === undefined) {
    return null;
  }
  return (
    <>
      {scale.ticks.map((t) => (
        <div
          aria-hidden
          className="absolute inset-y-0 w-px bg-neutral-200 dark:bg-neutral-700"
          key={t.pct}
          style={{ left: `${t.pct}%` }}
        />
      ))}
      {scale.todayPct === undefined ? null : (
        <div
          aria-hidden
          className="absolute inset-y-0 w-px bg-red-500/70"
          style={{ left: `${scale.todayPct}%` }}
        />
      )}
    </>
  );
};

/** One chart row: name + optional `owner · note` | track | date label. */
const Row = (props: {
  children?: ReactNode;
  dates?: string;
  name: string;
  note?: string;
  owner?: string;
}): ReactNode => {
  const sub = [props.owner, props.note].filter(nonEmpty).join(" · ");
  return (
    <div className={`${ROW_GRID} py-1`}>
      <RowLabel name={props.name} sub={sub} />
      <div className={TRACK_CLS}>
        <Guides />
        {props.children}
      </div>
      <div
        className={`text-right font-mono text-[0.62rem] tabular-nums ${TEXT.muted}`}
      >
        {props.dates}
      </div>
    </div>
  );
};

export const Task = defineComponent(
  {
    description:
      "ガントの1タスク行。name/start は必須 (ISO 日付)、end 省略時は start と同日。status でバーの色 (todo|doing|done|blocked)、progress は 0–100 の進捗塗り、owner/note は補足行",
    schema: v.looseObject({
      end: v.optional(v.string()),
      name: v.string(),
      note: v.optional(v.string()),
      owner: v.optional(v.string()),
      progress: v.optional(NUMISH),
      start: v.string(),
      status: STATUS_PROP,
    }),
  },
  ({ name, start, end, status, progress, owner, note }) => {
    const scale = useContext(ScaleCtx);
    const s = toDate(start);
    const e0 = toDate(end);
    const e = e0 === undefined || (s !== undefined && e0 < s) ? s : e0;
    const p = numOf(progress);
    const colors = status === undefined ? DEFAULT_BAR : BAR[status];

    let bar: { left: number; width: number } | undefined;
    if (scale !== undefined && s !== undefined && e !== undefined) {
      const left = clampPct(pctOf(s, scale));
      const right = clampPct(pctOf(addDays(e, 1), scale));
      bar = { left, width: Math.max(right - left, 0.8) };
    }
    const dates = s === undefined ? start : fmtRange(s, e ?? s);
    const tip = `${name} · ${dates}${status === undefined ? "" : ` · ${status}`}`;

    return (
      <Row dates={dates} name={name} note={note} owner={owner}>
        {bar === undefined ? null : (
          <div
            className={`absolute inset-y-0.5 overflow-hidden rounded-sm ${p === undefined ? colors.solid : colors.soft}`}
            style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
            title={tip}
          >
            {p === undefined ? null : (
              <div
                className={`absolute inset-y-0 left-0 ${colors.solid}`}
                style={{ width: `${Math.min(100, Math.max(0, p))}%` }}
              />
            )}
          </div>
        )}
      </Row>
    );
  }
);

export const Milestone = defineComponent(
  {
    description:
      "ガントのマイルストーン。name/date は必須 (ISO 日付)。status で菱形マーカーの色、owner/note は補足行",
    schema: v.looseObject({
      date: v.string(),
      name: v.string(),
      note: v.optional(v.string()),
      owner: v.optional(v.string()),
      status: STATUS_PROP,
    }),
  },
  ({ name, date, status, owner, note }) => {
    const scale = useContext(ScaleCtx);
    const d = toDate(date);
    const cls = status === undefined ? DEFAULT_MILESTONE : BAR[status].solid;
    const pct =
      scale === undefined || d === undefined
        ? undefined
        : clampPct(pctOf(d, scale));
    return (
      <Row
        dates={d === undefined ? date : format(d, "MMM d")}
        name={name}
        note={note}
        owner={owner}
      >
        {pct === undefined ? null : (
          <div
            className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] ${cls}`}
            style={{ left: `${pct}%` }}
            title={`${name} · ${date}`}
          />
        )}
      </Row>
    );
  }
);

/** Earliest/latest day across <Task>/<Milestone> children props. */
const collectDates = (children: ReactNode): Date[] => {
  const dates: Date[] = [];
  for (const n of flattenChildren(children)) {
    if (isEl(n, Task)) {
      const s = toDate(propOf(n, "start"));
      if (s !== undefined) {
        dates.push(s, toDate(propOf(n, "end")) ?? s);
      }
    } else if (isEl(n, Milestone)) {
      const d = toDate(propOf(n, "date"));
      if (d !== undefined) {
        dates.push(d);
      }
    }
  }
  return dates;
};

/**
 * The chart range: `start`/`end` props win, else the earliest child start
 * through the latest child end. Empty charts default to a 30-day window
 * from `fallback`.
 */
const resolveRange = (
  children: ReactNode,
  start: unknown,
  end: unknown,
  fallback: Date
): { last: Date; origin: Date; spanDays: number } => {
  let origin = toDate(start);
  let last = toDate(end);
  for (const d of collectDates(children)) {
    if (origin === undefined || d < origin) {
      origin = d;
    }
    if (last === undefined || d > last) {
      last = d;
    }
  }
  const o = origin ?? fallback;
  let l = last ?? addDays(o, 29);
  if (l < o) {
    l = o;
  }
  return {
    last: l,
    origin: o,
    spanDays: Math.max(1, differenceInCalendarDays(l, o) + 1),
  };
};

/** Day offset of the "today" marker — `false` disables, a date pins, else `now`. */
const todayOffsetOf = (
  today: unknown,
  origin: Date,
  fallback: Date
): number => {
  let d: Date | undefined;
  if (attrFalse(today)) {
    d = undefined;
  } else if (nonEmpty(today) && today !== "true") {
    d = toDate(today);
  } else {
    d = fallback;
  }
  return d === undefined ? -1 : differenceInCalendarDays(d, origin);
};

export const Gantt = defineComponent(
  {
    description:
      'ガントチャートコンテナ (日付ベースのスケジュール図)。<Task> と <Milestone> を並べる。start/end で表示範囲を上書き、today="false" で今日マーカー非表示、日付指定で固定',
    schema: v.looseObject({
      end: v.optional(v.string()),
      start: v.optional(v.string()),
      title: v.optional(v.string()),
      today: v.optional(v.string()),
    }),
  },
  ({ title, start, end, today, children }) => {
    const { now } = useContext(DocContext);
    const scale = useMemo<GanttScale>(() => {
      const fallback = now ?? new Date();
      const { origin, last, spanDays } = resolveRange(
        children,
        start,
        end,
        fallback
      );
      const todayOffset = todayOffsetOf(today, origin, fallback);
      return {
        last,
        origin,
        spanDays,
        ticks: ticksOf(origin, last, spanDays),
        todayPct:
          todayOffset < 0 || todayOffset >= spanDays
            ? undefined
            : (todayOffset / spanDays) * 100,
      };
    }, [children, start, end, today, now]);

    return (
      <Panel>
        {nonEmpty(title) ? (
          <CaptionBar className={CAPTION_TITLE_CLS}>
            <Icon className="h-3.5 w-3.5" name="lucide:chart-gantt" />
            <span className="min-w-0 flex-1 truncate">{title}</span>
            <span className={MONO_NUM_CLS}>
              {format(scale.origin, "MMM d")} –{" "}
              {format(scale.last, "MMM d, yyyy")}
            </span>
          </CaptionBar>
        ) : null}
        <div className="px-4 py-3">
          <div className={`${ROW_GRID} pb-1`}>
            <span />
            <span className="relative h-3.5">
              {scale.ticks.map((t) => (
                <span
                  className={`absolute -translate-x-1/2 font-mono text-[0.62rem] whitespace-nowrap tabular-nums ${TEXT.faint}`}
                  key={t.pct}
                  style={{ left: `${t.pct}%` }}
                >
                  {t.label}
                </span>
              ))}
            </span>
            <span />
          </div>
          <ScaleCtx.Provider value={scale}>{children}</ScaleCtx.Provider>
        </div>
      </Panel>
    );
  }
);

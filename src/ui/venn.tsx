import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren, parseProps } from "../define.js";
import { NUMISH, numOf } from "./attrs.js";
import { CODE_CHIP_CLS } from "./bits.js";
import { ChartPanel } from "./chart-bits.js";
import { CHART_TONES, fmtNum, textList, toneOf } from "./chart.js";
import { isEl } from "./children.js";
import { TEXT, TEXT_MICRO } from "./tones.js";

/**
 * Venn diagram — 2 or 3 <Set> circles plus <Overlap> labels at the
 * intersections. Circles are uniform (a Venn is not to scale); values
 * print inside each set's own region.
 */

const SET_SCHEMA = v.looseObject({
  name: v.string(),
  tone: v.optional(v.picklist(CHART_TONES)),
  value: NUMISH,
});

const OVERLAP_SCHEMA = v.looseObject({
  sets: v.string(),
  value: NUMISH,
});

type SetSpec = v.InferOutput<typeof SET_SCHEMA>;
type OverlapSpec = v.InferOutput<typeof OVERLAP_SCHEMA>;

export const Set = defineComponent(
  {
    description:
      "ベン図の1集合。<Venn> の子 (2–3個)。name/value は必須、tone で色",
    schema: SET_SCHEMA,
  },
  // Standalone use: a `name value` chip so misplaced sets still render.
  ({ name, value }): ReactElement => (
    <span className={`font-mono ${CODE_CHIP_CLS}`}>
      {name}
      <span className="opacity-70">{value}</span>
    </span>
  )
);

export const Overlap = defineComponent(
  {
    description:
      'ベン図の重なり領域。<Venn> の子。sets="a,b" で対象の Set 名 (2個なら両方)、value は必須',
    schema: OVERLAP_SCHEMA,
  },
  // Standalone use: a `a∩b value` chip so misplaced overlaps still render.
  ({ sets, value }): ReactElement => (
    <span className={`font-mono ${CODE_CHIP_CLS}`}>
      {sets.replaceAll(",", "∩")}
      <span className="opacity-70">{value}</span>
    </span>
  )
);

interface Circle {
  cx: number;
  cy: number;
  r: number;
  spec: SetSpec;
  value: number;
}

const collectSets = (
  children: ReactNode
): {
  overlaps: { names: string[]; spec: OverlapSpec; value: number }[];
  rest: ReactNode[];
  sets: { spec: SetSpec; value: number }[];
} => {
  const sets: { spec: SetSpec; value: number }[] = [];
  const overlaps: { names: string[]; spec: OverlapSpec; value: number }[] = [];
  const rest: ReactNode[] = [];
  for (const child of flattenChildren(children)) {
    if (isEl(child, Set)) {
      const spec = parseProps(SET_SCHEMA, child.props, "Set");
      sets.push({ spec, value: numOf(spec.value) ?? 0 });
    } else if (isEl(child, Overlap)) {
      const spec = parseProps(OVERLAP_SCHEMA, child.props, "Overlap");
      overlaps.push({
        names: textList(spec.sets),
        spec,
        value: numOf(spec.value) ?? 0,
      });
    } else {
      rest.push(child);
    }
  }
  return { overlaps, rest, sets };
};

const VB_W = 400;
const VB_H = 300;

/** Fixed circle geometry — index-aligned with the first 2–3 sets. */
const GEOMETRY: { cx: number; cy: number; r: number }[][] = [
  [],
  [],
  [
    { cx: 150, cy: 150, r: 92 },
    { cx: 250, cy: 150, r: 92 },
  ],
  [
    { cx: 200, cy: 116, r: 78 },
    { cx: 148, cy: 206, r: 78 },
    { cx: 252, cy: 206, r: 78 },
  ],
];

const NAME_TEXT = "fill-neutral-600 dark:fill-neutral-300";
const VALUE_TEXT = "fill-neutral-500 dark:fill-neutral-400";

export const Venn = defineComponent(
  {
    description:
      'ベン図コンテナ (集合の重なり)。<Set name value> を 2–3 個と <Overlap sets="a,b" value> で交差部の値。unit は値の単位',
    schema: v.looseObject({
      title: v.optional(v.string()),
      unit: v.optional(v.string()),
    }),
  },
  ({ title, unit, children }) => {
    const { sets, overlaps, rest } = collectSets(children);
    const geom = GEOMETRY[sets.length] ?? GEOMETRY[3];
    const circles: Circle[] = sets.map((s, i) => ({
      ...(geom[i] ?? geom.at(-1)),
      spec: s.spec,
      value: s.value,
    }));
    // A set's own label sits at its centroid pushed away from the other
    // circles' centers, so it lands in the non-overlapping region.
    const ownLabel = (c: Circle): { x: number; y: number } => {
      let dx = 0;
      let dy = 0;
      for (const o of circles) {
        if (o !== c) {
          dx += c.cx - o.cx;
          dy += c.cy - o.cy;
        }
      }
      const len = Math.hypot(dx, dy) || 1;
      return {
        x: c.cx + (dx / len) * c.r * 0.42,
        y: c.cy + (dy / len) * c.r * 0.42,
      };
    };
    // An overlap label sits at the mean of its member centers, pushed away
    // from the non-members' centers (into the member-only lens).
    const overlapLabel = (names: string[]): { x: number; y: number } => {
      const isMember = (c: Circle): boolean =>
        names.some(
          (n) =>
            c.spec.name === n || c.spec.name.toLowerCase() === n.toLowerCase()
        );
      const members = circles.filter(isMember);
      const others = circles.filter((c) => !isMember(c));
      const mx =
        members.reduce((a, c) => a + c.cx, 0) / Math.max(1, members.length);
      const my =
        members.reduce((a, c) => a + c.cy, 0) / Math.max(1, members.length);
      if (others.length === 0) {
        return { x: mx, y: my };
      }
      const ox =
        others.reduce((a, c) => a + c.cx, 0) / Math.max(1, others.length);
      const oy =
        others.reduce((a, c) => a + c.cy, 0) / Math.max(1, others.length);
      const dx = mx - ox;
      const dy = my - oy;
      const len = Math.hypot(dx, dy) || 1;
      return { x: mx + (dx / len) * 18, y: my + (dy / len) * 18 };
    };

    return (
      <ChartPanel icon="lucide:blend" title={title}>
        <div className="px-4 py-3">
          {circles.length < 2 ? (
            <p className={`text-sm ${TEXT.muted}`}>
              Venn needs at least 2 sets.
            </p>
          ) : (
            <svg
              className="mx-auto h-auto w-full max-w-md"
              viewBox={`0 0 ${VB_W} ${VB_H}`}
            >
              <title>{title ?? "venn diagram"}</title>
              {circles.map((c, i) => {
                const style = toneOf(c.spec.tone, i);
                return (
                  <circle
                    className={`${style.soft} ${style.stroke}`}
                    cx={c.cx}
                    cy={c.cy}
                    key={c.spec.name}
                    r={c.r}
                    strokeWidth={1.5}
                  />
                );
              })}
              {circles.map((c) => {
                const p = ownLabel(c);
                return (
                  <g key={c.spec.name}>
                    <text
                      className={NAME_TEXT}
                      fontSize={11}
                      fontWeight={600}
                      textAnchor="middle"
                      x={p.x}
                      y={p.y}
                    >
                      {c.spec.name}
                    </text>
                    <text
                      className={VALUE_TEXT}
                      fontSize={9}
                      textAnchor="middle"
                      x={p.x}
                      y={p.y + 12}
                    >
                      {fmtNum(c.value)}
                      {unit}
                    </text>
                  </g>
                );
              })}
              {overlaps.map((o) => {
                const p = overlapLabel(o.names);
                return (
                  <text
                    className={VALUE_TEXT}
                    fontSize={10}
                    fontWeight={600}
                    key={o.spec.sets}
                    textAnchor="middle"
                    x={p.x}
                    y={p.y + 3}
                  >
                    {fmtNum(o.value)}
                  </text>
                );
              })}
            </svg>
          )}
          {rest.length > 0 ? (
            <div className={`${TEXT_MICRO} ${TEXT.muted}`}>{rest}</div>
          ) : null}
        </div>
      </ChartPanel>
    );
  }
);

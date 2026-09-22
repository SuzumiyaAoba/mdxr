import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren, parseProps } from "../define.js";
import { nonEmpty } from "../guards.js";
import { NUMISH, numOf } from "./attrs.js";
import { ChartPanel } from "./chart-bits.js";
import {
  CHART_TONES,
  fmtNum,
  layoutSankey,
  textList,
  toneOf,
} from "./chart.js";
import { isEl, propOf } from "./children.js";
import { NODE_SCHEMA, Node } from "./graph-specs.js";
import { Icon } from "./icon.js";
import { TEXT } from "./tones.js";

/**
 * Sankey diagram — a quantity splitting/merging across stage columns;
 * ribbon thickness ∝ `<Link>` `value`. Nodes are implicit from link
 * endpoints; `<Node id label stage>` children rename/reorder them.
 */

const LINK_SCHEMA = v.looseObject({
  from: v.string(),
  label: v.optional(v.string()),
  to: v.string(),
  value: NUMISH,
});

export const Link = defineComponent(
  {
    description:
      "サンキー図のフロー。<Sankey> の子。from/to はノード id、value は流量 (リボンの太さ)。label で補足",
    schema: LINK_SCHEMA,
  },
  // Standalone use: a `from → to value` line so misplaced links still render.
  ({ from, to, value, label }): ReactElement => (
    <div
      className={`not-prose flex items-center gap-2 py-0.5 font-mono text-xs ${TEXT.muted}`}
    >
      <span>{from}</span>
      <Icon className="h-3 w-3" name="lucide:arrow-right" />
      <span>{to}</span>
      <span className="opacity-70">{value}</span>
      {nonEmpty(label) ? <span className="opacity-70">{label}</span> : null}
    </div>
  )
);

interface SankeyData {
  /** Display label per node id (defaults to id). */
  labels: Map<string, string>;
  links: { from: string; to: string; value: number }[];
  nodes: { id: string; stage?: number; tone?: string }[];
  rest: ReactNode[];
}

/** Raw `stage` attr → number; numbers pass through, strings parse, rest is undefined. */
const stageOf = (raw: unknown): number | undefined => {
  if (typeof raw === "number") {
    return raw;
  }
  if (typeof raw === "string" && raw !== "") {
    return numOf(raw);
  }
  return undefined;
};

/** Raw `tone` attr → palette tone name, or undefined for unknown values. */
const toneOfProp = (raw: unknown): string | undefined =>
  typeof raw === "string" && (CHART_TONES as readonly string[]).includes(raw)
    ? raw
    : undefined;

const collectNode = (child: ReactElement, data: SankeyData): void => {
  const spec = parseProps(NODE_SCHEMA, child.props, "Node");
  data.nodes.push({
    id: spec.id,
    stage: stageOf(propOf(child, "stage")),
    tone: toneOfProp(propOf(child, "tone")),
  });
  if (nonEmpty(spec.label)) {
    data.labels.set(spec.id, spec.label);
  }
};

const collectFlow = (children: ReactNode): SankeyData => {
  const data: SankeyData = {
    labels: new Map(),
    links: [],
    nodes: [],
    rest: [],
  };
  for (const child of flattenChildren(children)) {
    if (isEl(child, Link)) {
      const spec = parseProps(LINK_SCHEMA, child.props, "Link");
      data.links.push({
        from: spec.from,
        to: spec.to,
        value: Math.max(0, numOf(spec.value) ?? 0),
      });
    } else if (isEl(child, Node)) {
      collectNode(child, data);
    } else {
      data.rest.push(child);
    }
  }
  return data;
};

const VB_W = 640;
const VB_H = 340;
const TOP = 44;
const BOTTOM = 12;
const H = VB_H - TOP - BOTTOM;
const BAR_W = 10;
const GAP = 24;
const L_MARGIN = 96;
const R_MARGIN = 96;

const AXIS_TEXT = "fill-neutral-500 dark:fill-neutral-400";

/** Node label position — left of stage-0 bars, right of last-stage bars, centered above inner bars. */
const labelPos = (
  stage: number,
  last: number,
  barX: number
): { anchor: "end" | "middle" | "start"; x: number } => {
  if (stage === 0) {
    return { anchor: "end", x: barX - 8 };
  }
  if (stage === last) {
    return { anchor: "start", x: barX + BAR_W + 8 };
  }
  return { anchor: "middle", x: barX + BAR_W / 2 };
};

export const Sankey = defineComponent(
  {
    description:
      'サンキー図コンテナ (量の分配・合流)。<Link from to value> がリボン、<Node id label stage> でラベル/列指定。stages="A,B,C" で列ヘッダ、unit は値の単位',
    schema: v.looseObject({
      stages: v.optional(v.string()),
      title: v.optional(v.string()),
      unit: v.optional(v.string()),
    }),
  },
  ({ title, stages, unit, children }) => {
    const { links, nodes, labels, rest } = collectFlow(children);
    const layout = layoutSankey(
      { links, nodes: nodes.map((n) => ({ id: n.id, stage: n.stage })) },
      H,
      GAP
    );
    const colX = (stage: number): number =>
      layout.stages <= 1
        ? VB_W / 2
        : L_MARGIN +
          (stage / (layout.stages - 1)) * (VB_W - L_MARGIN - R_MARGIN - BAR_W);
    const headers = textList(stages);
    const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));
    const toneIdx = new Map(layout.nodes.map((n, i) => [n.id, i] as const));
    const styleOfNode = (id: string): ReturnType<typeof toneOf> => {
      const specTone = nodes.find((n) => n.id === id)?.tone;
      return toneOf(specTone, toneIdx.get(id) ?? 0);
    };
    const last = layout.stages - 1;

    return (
      <ChartPanel icon="lucide:waypoints" title={title}>
        <div className="overflow-x-auto px-4 py-3">
          <svg
            className="h-auto w-full min-w-[28rem]"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
          >
            <title>{title ?? "sankey diagram"}</title>
            {headers.map((h, i) =>
              i >= layout.stages ? null : (
                <text
                  className={AXIS_TEXT}
                  fontSize={8}
                  key={h}
                  letterSpacing="0.12em"
                  textAnchor="middle"
                  x={colX(i) + BAR_W / 2}
                  y={12}
                >
                  {h.toUpperCase()}
                </text>
              )
            )}
            {layout.links.map((l, i) => {
              const s = nodeById.get(l.from);
              const t = nodeById.get(l.to);
              if (s === undefined || t === undefined || l.value <= 0) {
                return null;
              }
              const x1 = colX(s.stage) + BAR_W;
              const x2 = colX(t.stage);
              const y0 = TOP + s.y + l.sy;
              const y1 = TOP + t.y + l.ty;
              const th = Math.max(1, l.value * layout.k);
              const midX = (x1 + x2) / 2;
              const d = `M${x1} ${y0}C${midX} ${y0} ${midX} ${y1} ${x2} ${y1}L${x2} ${y1 + th}C${midX} ${y1 + th} ${midX} ${y0 + th} ${x1} ${y0 + th}Z`;
              return (
                <path className={styleOfNode(l.from).soft} d={d} key={`l${i}`}>
                  <title>
                    {`${labels.get(l.from) ?? l.from} → ${labels.get(l.to) ?? l.to} · ${fmtNum(l.value)}${unit ?? ""}`}
                  </title>
                </path>
              );
            })}
            {layout.nodes.map((n) => {
              const x = colX(n.stage);
              const label = labels.get(n.id) ?? n.id;
              const edge = n.stage === 0 || n.stage === last;
              const { anchor, x: textX } = labelPos(n.stage, last, x);
              return (
                <g key={n.id}>
                  <rect
                    className={styleOfNode(n.id).fill}
                    height={n.h}
                    rx={1.5}
                    width={BAR_W}
                    x={x}
                    y={TOP + n.y}
                  >
                    <title>{`${label} · ${fmtNum(n.value)}${unit ?? ""}`}</title>
                  </rect>
                  {edge ? (
                    <>
                      <text
                        className={AXIS_TEXT}
                        fontSize={10}
                        textAnchor={anchor}
                        x={textX}
                        y={TOP + n.y + n.h / 2 - 1}
                      >
                        {label}
                      </text>
                      <text
                        className="fill-neutral-400 dark:fill-neutral-500"
                        fontSize={8}
                        textAnchor={anchor}
                        x={textX}
                        y={TOP + n.y + n.h / 2 + 10}
                      >
                        {fmtNum(n.value)}
                        {unit}
                      </text>
                    </>
                  ) : (
                    <>
                      <text
                        className={AXIS_TEXT}
                        fontSize={10}
                        textAnchor={anchor}
                        x={textX}
                        y={TOP + n.y - 12}
                      >
                        {label}
                      </text>
                      <text
                        className="fill-neutral-400 dark:fill-neutral-500"
                        fontSize={8}
                        textAnchor={anchor}
                        x={textX}
                        y={TOP + n.y - 3}
                      >
                        {fmtNum(n.value)}
                        {unit}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        {rest.length > 0 ? <div className="px-4 pb-3">{rest}</div> : null}
      </ChartPanel>
    );
  }
);

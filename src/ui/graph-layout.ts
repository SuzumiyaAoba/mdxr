import { graphlib, layout } from "@dagrejs/dagre";
import type { EdgeLabel, GraphLabel, NodeLabel, Point } from "@dagrejs/dagre";

import { nonEmpty } from "../guards.js";
import type { EdgeSpec, NodeSpec } from "./graph-specs.js";

/**
 * dagre layout for `<Graph>` plus the SVG geometry the edge renderer uses:
 * smoothed routed paths, arrowheads, label anchors, and text-size guesses
 * (SSR can't measure, so node width/height is estimated from its label).
 */

const RANKDIRS = { down: "TB", left: "RL", right: "LR", up: "BT" } as const;
export type GraphDirection = keyof typeof RANKDIRS;

/** East-Asian wide/fullwidth glyphs take ~1.7 mono cells vs ASCII's one. */
const WIDE_CHAR =
  /[ᄀ-ᄟ⺀-꓏가-힣豈-﫿︰-﹏＀-￯\u{20000}-\u{2FFFD}\u{30000}-\u{3FFFD}]/u;

/** Text width in mono "cells" — SSR can't measure, so wide chars count extra. */
const textCells = (s: string): number => {
  let cells = 0;
  for (const ch of s) {
    cells += WIDE_CHAR.test(ch) ? 1.7 : 1;
  }
  return cells;
};

export const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/** Catmull-style smoothing through dagre's routed waypoints. */
export const smoothPath = (pts: Point[]): string => {
  if (pts.length < 2) {
    return "";
  }
  const [first, ...rest] = pts;
  const last = pts.at(-1) ?? first;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 0; i < rest.length - 1; i += 1) {
    const p = rest[i] ?? first;
    const mid = midpoint(p, rest[i + 1] ?? p);
    d += ` Q ${p.x} ${p.y} ${mid.x} ${mid.y}`;
  }
  return `${d} L ${last.x} ${last.y}`;
};

/** Two-stroke arrowhead at the path end, along the last segment's direction. */
export const arrowPath = (pts: Point[]): string => {
  if (pts.length < 2) {
    return "";
  }
  const tip = pts.at(-1) ?? { x: 0, y: 0 };
  const prev = pts.at(-2) ?? tip;
  const dx = tip.x - prev.x;
  const dy = tip.y - prev.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const bx = tip.x - ux * 9;
  const by = tip.y - uy * 9;
  const px = -uy * 3.4;
  const py = ux * 3.4;
  return `M ${bx + px} ${by + py} L ${tip.x} ${tip.y} L ${bx - px} ${by - py}`;
};

/** Label anchor: middle waypoint (odd counts) or middle of the center span. */
export const labelPoint = (pts: Point[]): Point => {
  const n = pts.length;
  if (n === 0) {
    return { x: 0, y: 0 };
  }
  if (n % 2 === 1) {
    return pts[(n - 1) / 2] ?? { x: 0, y: 0 };
  }
  return midpoint(
    pts[n / 2 - 1] ?? { x: 0, y: 0 },
    pts[n / 2] ?? { x: 0, y: 0 }
  );
};

/** Width/height guesses for layout — SSR can't measure, so text is estimated. */
export const nodeSize = (s: NodeSpec): { height: number; width: number } => {
  const label = nonEmpty(s.label) ? s.label : s.id;
  const labelW =
    textCells(label) * 7.4 +
    (nonEmpty(s.icon) || nonEmpty(s.path) ? 20 : 0) +
    (s.status === undefined ? 0 : 16);
  const noteW = nonEmpty(s.note) ? textCells(s.note) * 7.4 : 0;
  return {
    height: nonEmpty(s.note) ? 52 : 38,
    width: Math.round(
      Math.min(240, Math.max(92, 26 + Math.max(labelW, noteW)))
    ),
  };
};

/**
 * Chip-size guess for an edge label. Passed to dagre so the rank channel
 * widens to fit it — without it labels land on top of neighboring nodes.
 */
export const edgeLabelSize = (
  label: string
): { height: number; width: number } => ({
  height: 22,
  width: Math.round(textCells(label) * 6.9 + 16),
});

export type DagreGraph = graphlib.Graph<GraphLabel, NodeLabel, EdgeLabel>;

/** dagre edge name per live-edge index — names keep parallel edges distinct. */
export const edgeKey = (i: number): string => `e${i}`;

/** dagre layout pass: nodes in spec order (dupes skipped), live edges only. */
export const layoutGraph = (
  nodes: NodeSpec[],
  edges: EdgeSpec[],
  direction: GraphDirection
): { g: DagreGraph; height: number; liveEdges: EdgeSpec[]; width: number } => {
  const g: DagreGraph = new graphlib.Graph({ multigraph: true });
  g.setGraph({
    marginx: 10,
    marginy: 10,
    nodesep: 18,
    rankdir: RANKDIRS[direction],
    ranksep: 54,
  });
  g.setDefaultEdgeLabel(() => ({}));
  const seen = new Set<string>();
  for (const n of nodes) {
    if (seen.has(n.id)) {
      continue;
    }
    seen.add(n.id);
    g.setNode(n.id, nodeSize(n));
  }
  const liveEdges = edges.filter((e) => g.hasNode(e.from) && g.hasNode(e.to));
  for (const [i, e] of liveEdges.entries()) {
    const label = nonEmpty(e.label)
      ? { ...edgeLabelSize(e.label), labelpos: "c" as const }
      : {};
    g.setEdge({ name: edgeKey(i), v: e.from, w: e.to }, label);
  }
  layout(g);
  const { width = 0, height = 0 } = g.graph();
  return { g, height, liveEdges, width };
};

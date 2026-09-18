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
  const w =
    26 +
    label.length * 7.4 +
    (nonEmpty(s.icon) || nonEmpty(s.path) ? 20 : 0) +
    (s.status === undefined ? 0 : 16);
  return {
    height: nonEmpty(s.note) ? 52 : 38,
    width: Math.round(Math.min(240, Math.max(92, w))),
  };
};

export type DagreGraph = graphlib.Graph<GraphLabel, NodeLabel, EdgeLabel>;

/** dagre layout pass: nodes in spec order (dupes skipped), live edges only. */
export const layoutGraph = (
  nodes: NodeSpec[],
  edges: EdgeSpec[],
  direction: GraphDirection
): { g: DagreGraph; height: number; liveEdges: EdgeSpec[]; width: number } => {
  const g: DagreGraph = new graphlib.Graph();
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
  for (const e of liveEdges) {
    g.setEdge(e.from, e.to);
  }
  layout(g);
  const { width = 0, height = 0 } = g.graph();
  return { g, height, liveEdges, width };
};

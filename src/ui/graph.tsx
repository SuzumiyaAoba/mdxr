import { graphlib, layout } from "@dagrejs/dagre";
import type { EdgeLabel, GraphLabel, NodeLabel, Point } from "@dagrejs/dagre";
import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { nonEmpty } from "../guards.js";
import { DEP_KINDS } from "./deps.js";
import type { DepKind } from "./deps.js";
import { fileIcon } from "./file-icon.js";
import { linkTarget, useFileLink } from "./file-link.js";
import { hasIcon, Icon } from "./icon.js";
import { STATUS_ICONS, STATUSES } from "./status-badge.js";
import type { Status } from "./status-badge.js";

/**
 * Static node/edge graph — the "React Flow" slot in the catalog, rendered
 * with no client JS: dagre computes the layout at render time and the result
 * is emitted as absolute-positioned HTML nodes over an SVG edge layer. Nodes
 * carrying `path` link to the file in the reader's editor (mermaid can't).
 */

const NODE_SCHEMA = v.looseObject({
  external: v.optional(v.union([v.boolean(), v.string()])),
  href: v.optional(v.string()),
  icon: v.optional(v.string()),
  id: v.string(),
  label: v.optional(v.string()),
  lines: v.optional(v.string()),
  note: v.optional(v.string()),
  path: v.optional(v.string()),
  status: v.optional(v.picklist(STATUSES)),
});

const EDGE_SCHEMA = v.looseObject({
  from: v.string(),
  kind: v.optional(v.picklist(DEP_KINDS)),
  label: v.optional(v.string()),
  to: v.string(),
});

type NodeSpec = v.InferOutput<typeof NODE_SCHEMA>;
type EdgeSpec = v.InferOutput<typeof EDGE_SCHEMA>;

export const Node = defineComponent(
  {
    description:
      "Graph のノード。<Graph> の子として使う。id は必須、label/note/icon で表示を調整。path/lines で実ファイルへのエディタリンク、status でステータス点、external で外部依存スタイル",
    schema: NODE_SCHEMA,
  },
  // Standalone use (outside <Graph>): a small chip so misplaced nodes still render.
  ({ id, label, icon, path, status }) => (
    <span className="not-prose inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2 py-0.5 font-mono text-xs text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200">
      {hasIcon(icon) ? <Icon className="h-3 w-3" name={icon} /> : null}
      {!hasIcon(icon) && nonEmpty(path) ? (
        <Icon className="h-3 w-3" name={fileIcon(path)} />
      ) : null}
      {nonEmpty(label) ? label : id}
      {status === undefined ? null : (
        <Icon className="h-3 w-3" name={STATUS_ICONS[status]} />
      )}
    </span>
  )
);

export const Edge = defineComponent(
  {
    description:
      "Graph のエッジ。<Graph> の子として使う。from/to は Node の id。kind は Dep と同じ imports|calls|extends|implements|reads|writes で色が付く。label でエッジ中央にチップ",
    schema: EDGE_SCHEMA,
  },
  // Standalone use renders a plain `from → to` line.
  ({ from, to, label, kind }) => (
    <div className="not-prose flex items-center gap-2 py-0.5 font-mono text-xs text-neutral-500 dark:text-neutral-400">
      <span>{from}</span>
      <Icon className="h-3 w-3" name="lucide:arrow-right" />
      <span>{to}</span>
      {nonEmpty(kind) ? <span className="opacity-70">{kind}</span> : null}
      {nonEmpty(label) ? <span className="opacity-70">{label}</span> : null}
    </div>
  )
);

/** text-* classes double as `stroke="currentColor"` colors on SVG paths. */
const EDGE_COLORS: Record<DepKind, string> = {
  calls: "text-sky-500 dark:text-sky-400",
  extends: "text-violet-500 dark:text-violet-400",
  implements: "text-teal-500 dark:text-teal-400",
  imports: "text-neutral-400 dark:text-neutral-500",
  reads: "text-neutral-400 dark:text-neutral-500",
  writes: "text-amber-500 dark:text-amber-400",
};

const STATUS_DOT: Record<Status, string> = {
  blocked: "text-red-500",
  doing: "text-sky-500",
  done: "text-emerald-500",
  todo: "text-neutral-400",
};

const RANKDIRS = { down: "TB", left: "RL", right: "LR", up: "BT" } as const;

const midpoint = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

/** Catmull-style smoothing through dagre's routed waypoints. */
const smoothPath = (pts: Point[]): string => {
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
const arrowPath = (pts: Point[]): string => {
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
const labelPoint = (pts: Point[]): Point => {
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

const parseSpec = <S extends v.GenericSchema>(
  schema: S,
  props: unknown,
  tag: string
): v.InferOutput<S> => {
  const r = v.safeParse(schema, props);
  if (!r.success) {
    const detail = r.issues
      .map(
        (i) =>
          `${i.path?.map((p) => String(p.key)).join(".") ?? "props"}: ${i.message}`
      )
      .join("; ");
    throw new Error(`Invalid props on <${tag}>: ${detail}`);
  }
  return r.output;
};

/** Width/height guesses for layout — SSR can't measure, so text is estimated. */
const nodeSize = (s: NodeSpec): { height: number; width: number } => {
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

const isTruthy = (x: unknown): boolean =>
  x === true || x === "true" || x === "";

/** Explicit `icon` wins; a `path` falls back to the file-type icon. */
const nodeIcon = (spec: NodeSpec): string | undefined => {
  if (hasIcon(spec.icon)) {
    return spec.icon;
  }
  return nonEmpty(spec.path) ? fileIcon(spec.path) : undefined;
};

const GraphNode = ({
  spec,
  x,
  y,
}: {
  spec: NodeSpec;
  x: number;
  y: number;
}): ReactElement => {
  const { width, height } = nodeSize(spec);
  const link = useFileLink(spec.path, spec.lines, spec.href);
  const icon = nodeIcon(spec);
  const external = isTruthy(spec.external);
  const card = (
    <div
      className={`flex h-full w-full flex-col justify-center rounded-lg border px-2.5 shadow-sm ${
        external
          ? "border-dashed border-neutral-300 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/60"
          : "border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950"
      }`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {icon === undefined ? null : (
          <Icon
            className="h-3.5 w-3.5 shrink-0 text-neutral-500 dark:text-neutral-400"
            name={icon}
          />
        )}
        <span className="truncate font-mono text-xs font-medium text-neutral-800 dark:text-neutral-200">
          {nonEmpty(spec.label) ? spec.label : spec.id}
        </span>
        {spec.status === undefined ? null : (
          <Icon
            className={`h-3 w-3 shrink-0 ${STATUS_DOT[spec.status]}`}
            label={spec.status}
            name={STATUS_ICONS[spec.status]}
          />
        )}
      </div>
      {nonEmpty(spec.note) ? (
        <div className="mt-0.5 truncate text-[0.68rem] text-neutral-400 dark:text-neutral-500">
          {spec.note}
        </div>
      ) : null}
    </div>
  );
  return (
    <div
      className="absolute"
      style={{
        height,
        left: x - width / 2,
        top: y - height / 2,
        width,
      }}
    >
      {link === undefined ? (
        card
      ) : (
        <a
          className="block h-full text-inherit no-underline transition-transform hover:-translate-y-px"
          href={link}
          {...linkTarget(link)}
        >
          {card}
        </a>
      )}
    </div>
  );
};

export const Graph = defineComponent(
  {
    description:
      "ノード/エッジのグラフ図 (dagre で静的レイアウト、JS 不要)。子に <Node id> と <Edge from to>。direction は down|right|up|left。path 付きノードはエディタリンクになる",
    schema: v.looseObject({
      direction: v.optional(
        v.picklist(["down", "right", "up", "left"]),
        "down"
      ),
      title: v.optional(v.string()),
    }),
  },
  ({ title, direction, children }) => {
    const nodes: NodeSpec[] = [];
    const edges: EdgeSpec[] = [];
    const rest: ReactNode[] = [];
    for (const child of flattenChildren(children)) {
      if (isValidElement(child) && child.type === Node) {
        nodes.push(parseSpec(NODE_SCHEMA, child.props, "Node"));
      } else if (isValidElement(child) && child.type === Edge) {
        edges.push(parseSpec(EDGE_SCHEMA, child.props, "Edge"));
      } else {
        rest.push(child);
      }
    }

    if (nodes.length === 0) {
      // No <Node> children: render content as-is (standalone Node/Edge views).
      return (
        <section className="my-6">
          {nonEmpty(title) ? <h3 className="mt-0">{title}</h3> : null}
          {rest}
        </section>
      );
    }

    const g = new graphlib.Graph<GraphLabel, NodeLabel, EdgeLabel>();
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
    return (
      <figure className="not-prose my-6 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        {nonEmpty(title) ? (
          <figcaption className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-medium text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            <Icon className="h-3.5 w-3.5" name="lucide:workflow" />
            {title}
          </figcaption>
        ) : null}
        <div className="overflow-x-auto bg-neutral-50/60 p-3 dark:bg-neutral-900/40">
          <div className="relative" style={{ height, minWidth: "100%", width }}>
            <svg
              aria-hidden
              className="absolute inset-0"
              height={height}
              width={width}
            >
              {liveEdges.map((e, i) => {
                const pts = g.edge(e.from, e.to)?.points;
                if (pts === undefined || pts.length < 2) {
                  return null;
                }
                const cls =
                  EDGE_COLORS[e.kind ?? "imports"] ?? EDGE_COLORS.imports;
                return (
                  <g className={cls} key={i}>
                    <path
                      d={smoothPath(pts)}
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                    />
                    <path
                      d={arrowPath(pts)}
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                    />
                  </g>
                );
              })}
            </svg>
            {liveEdges.map((e, i) => {
              if (!nonEmpty(e.label)) {
                return null;
              }
              const pts = g.edge(e.from, e.to)?.points;
              if (pts === undefined || pts.length === 0) {
                return null;
              }
              const p = labelPoint(pts);
              return (
                <span
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded border border-neutral-200 bg-white px-1.5 py-px font-mono text-[0.65rem] whitespace-nowrap text-neutral-500 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
                  key={`label-${i}`}
                  style={{ left: p.x, top: p.y }}
                >
                  {e.label}
                </span>
              );
            })}
            {nodes.map((n) => {
              const pos = g.node(n.id);
              if (pos?.x === undefined || pos.y === undefined) {
                return null;
              }
              return <GraphNode key={n.id} spec={n} x={pos.x} y={pos.y} />;
            })}
          </div>
        </div>
        {rest.length > 0 ? <div className="px-4 py-2">{rest}</div> : null}
      </figure>
    );
  }
);

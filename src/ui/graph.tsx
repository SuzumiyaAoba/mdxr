import type { ReactElement } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { attrTrue } from "./attrs.js";
import { CaptionBar, MaybeLink, Panel, Section } from "./bits.js";
import type { DepKind } from "./deps.js";
import { fileIcon } from "./file-icon.js";
import { useFileLink } from "./file-link.js";
import type { DagreGraph } from "./graph-layout.js";
import {
  arrowPath,
  labelPoint,
  layoutGraph,
  nodeSize,
  smoothPath,
} from "./graph-layout.js";
import type { EdgeSpec, NodeSpec } from "./graph-specs.js";
import { collectSpecs } from "./graph-specs.js";
import { hasIcon, Icon } from "./icon.js";
import { STATUS_ICON_CLS, STATUS_ICONS } from "./status-badge.js";
import { TEXT } from "./tones.js";

export { Edge, Node } from "./graph-specs.js";

/**
 * Static node/edge graph — the "React Flow" slot in the catalog, rendered
 * with no client JS: dagre computes the layout at render time and the result
 * is emitted as absolute-positioned HTML nodes over an SVG edge layer. Nodes
 * carrying `path` link to the file in the reader's editor (mermaid can't).
 * Schemas/spec collection live in `graph-specs.tsx`, layout in
 * `graph-layout.ts`.
 */

/** text-* classes double as `stroke="currentColor"` colors on SVG paths. */
const EDGE_COLORS: Record<DepKind, string> = {
  calls: "text-sky-500 dark:text-sky-400",
  extends: "text-violet-500 dark:text-violet-400",
  implements: "text-teal-500 dark:text-teal-400",
  imports: TEXT.faint,
  reads: TEXT.faint,
  writes: "text-amber-500 dark:text-amber-400",
};

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
  const external = attrTrue(spec.external);
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
          <Icon className={`h-3.5 w-3.5 shrink-0 ${TEXT.muted}`} name={icon} />
        )}
        <span className={`truncate font-mono text-xs font-medium ${TEXT.code}`}>
          {nonEmpty(spec.label) ? spec.label : spec.id}
        </span>
        {spec.status === undefined ? null : (
          <Icon
            className={`h-3 w-3 shrink-0 ${STATUS_ICON_CLS[spec.status]}`}
            label={spec.status}
            name={STATUS_ICONS[spec.status]}
          />
        )}
      </div>
      {nonEmpty(spec.note) ? (
        <div className={`mt-0.5 truncate text-[0.68rem] ${TEXT.faint}`}>
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
      <MaybeLink
        className="block h-full text-inherit no-underline transition-transform hover:-translate-y-px"
        href={link}
      >
        {card}
      </MaybeLink>
    </div>
  );
};

/** Routed edge: smoothed path plus its arrowhead, tinted via EDGE_COLORS. */
const EdgePath = ({
  e,
  g,
}: {
  e: EdgeSpec;
  g: DagreGraph;
}): ReactElement | null => {
  const pts = g.edge(e.from, e.to)?.points;
  if (pts === undefined || pts.length < 2) {
    return null;
  }
  const cls = EDGE_COLORS[e.kind ?? "imports"] ?? EDGE_COLORS.imports;
  return (
    <g className={cls}>
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
};

/** Edge label chip, positioned at the route's midpoint. */
const EdgeLabelChip = ({
  e,
  g,
}: {
  e: EdgeSpec;
  g: DagreGraph;
}): ReactElement | null => {
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
      style={{ left: p.x, top: p.y }}
    >
      {e.label}
    </span>
  );
};

/** Node card at its laid-out position; null while dagre has no position. */
const PlacedNode = ({
  g,
  n,
}: {
  g: DagreGraph;
  n: NodeSpec;
}): ReactElement | null => {
  const pos = g.node(n.id);
  if (pos?.x === undefined || pos.y === undefined) {
    return null;
  }
  return <GraphNode spec={n} x={pos.x} y={pos.y} />;
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
    const { edges, nodes, rest } = collectSpecs(children);

    // Duplicate ids would stack at the same dagre position (and repeat a
    // React key) — first wins, matching layoutGraph's own dedup.
    const seen = new Set<string>();
    const uniqueNodes = nodes.filter((n) => {
      if (seen.has(n.id)) {
        return false;
      }
      seen.add(n.id);
      return true;
    });

    if (uniqueNodes.length === 0) {
      // No <Node> children: render content as-is (standalone Node/Edge views).
      return <Section title={title}>{rest}</Section>;
    }

    const { g, height, liveEdges, width } = layoutGraph(
      uniqueNodes,
      edges,
      direction
    );
    return (
      <Panel>
        {nonEmpty(title) ? (
          <CaptionBar className="flex items-center gap-2 font-medium">
            <Icon className="h-3.5 w-3.5" name="lucide:workflow" />
            {title}
          </CaptionBar>
        ) : null}
        <div className="overflow-x-auto bg-neutral-50/60 p-3 dark:bg-neutral-900/40">
          <div className="relative" style={{ height, minWidth: "100%", width }}>
            <svg
              aria-hidden
              className="absolute inset-0"
              height={height}
              width={width}
            >
              {liveEdges.map((e, i) => (
                <EdgePath e={e} g={g} key={i} />
              ))}
            </svg>
            {liveEdges.map((e, i) => (
              <EdgeLabelChip e={e} g={g} key={`label-${i}`} />
            ))}
            {uniqueNodes.map((n) => (
              <PlacedNode g={g} key={n.id} n={n} />
            ))}
          </div>
        </div>
        {rest.length > 0 ? <div className="px-4 py-2">{rest}</div> : null}
      </Panel>
    );
  }
);

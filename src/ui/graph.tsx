import type { EdgeLabel } from "@dagrejs/dagre";
import type { ReactElement } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { FINITE_NUMBER } from "../research.js";
import { attrTrue } from "./attrs.js";
import { CaptionBar, MaybeLink, Panel, Section } from "./bits.js";
import type { DepKind } from "./deps.js";
import { fileIcon } from "./file-icon.js";
import { useFileLink } from "./file-link.js";
import type { DagreGraph } from "./graph-layout.js";
import {
  arrowPath,
  edgeKey,
  labelPoint,
  layoutGraph,
  nodeSize,
  smoothPath,
} from "./graph-layout.js";
import type { EdgeSpec, NodeSpec } from "./graph-specs.js";
import { collectSpecs } from "./graph-specs.js";
import { GraphViewport } from "./graph-viewport.js";
import { hasIcon, Icon } from "./icon.js";
import { STATUS_ICON_CLS, STATUS_ICONS } from "./status-badge.js";
import {
  BORDER_CLS,
  CAPTION_TITLE_CLS,
  CHIP_BORDER_CLS,
  MONO_TAG_CLS,
  SUNKEN_CLS,
  TEXT,
  TEXT_SUB,
  TONE_TEXT,
} from "./tones.js";

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
  calls: TONE_TEXT.sky,
  extends: TONE_TEXT.violet,
  implements: TONE_TEXT.teal,
  imports: TONE_TEXT.neutral,
  reads: TONE_TEXT.neutral,
  writes: TONE_TEXT.amber,
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
      className={`flex h-full w-full flex-col justify-center rounded-md border px-2.5 shadow-sm ${
        external
          ? `border-dashed ${CHIP_BORDER_CLS} ${SUNKEN_CLS}`
          : `${BORDER_CLS} bg-white dark:bg-neutral-950`
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
        <div className={`mt-0.5 truncate ${TEXT_SUB} ${TEXT.faint}`}>
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

/** Unfilled rounded stroke in the group's currentColor — edge body/arrowhead. */
const StrokePath = ({ d }: { d: string }): ReactElement => (
  <path
    d={d}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.5}
  />
);

/** Routed edge: smoothed path plus its arrowhead, tinted via EDGE_COLORS. */
const EdgePath = ({
  e,
  edge,
}: {
  e: EdgeSpec;
  edge: EdgeLabel;
}): ReactElement | null => {
  const pts = edge.points;
  if (pts === undefined || pts.length < 2) {
    return null;
  }
  const cls = EDGE_COLORS[e.kind ?? "imports"] ?? EDGE_COLORS.imports;
  return (
    <g className={cls}>
      <StrokePath d={smoothPath(pts)} />
      <StrokePath d={arrowPath(pts)} />
    </g>
  );
};

/** Edge label chip at the position dagre reserved for it during layout. */
const EdgeLabelChip = ({
  e,
  edge,
}: {
  e: EdgeSpec;
  edge: EdgeLabel;
}): ReactElement | null => {
  if (!nonEmpty(e.label)) {
    return null;
  }
  // Labeled edges carry dagre-computed x/y; the route midpoint is a fallback.
  const p =
    edge.x === undefined || edge.y === undefined
      ? labelPoint(edge.points ?? [])
      : { x: edge.x, y: edge.y };
  return (
    <span
      className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 ${MONO_TAG_CLS} whitespace-nowrap shadow-sm`}
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
      "ノード/エッジのグラフ図 (dagre で静的レイアウト、JS 不要)。子に <Node id> と <Edge from to>。direction は down|right|up|left。path 付きノードはエディタリンクになる。fit=auto (既定) で幅に合わせて縮小、minScale=0.85 が下限。fit=scroll は原寸",
    schema: v.looseObject({
      direction: v.optional(
        v.picklist(["down", "right", "up", "left"]),
        "down"
      ),
      fit: v.optional(v.picklist(["auto", "scroll"]), "auto"),
      minScale: v.optional(
        v.pipe(FINITE_NUMBER, v.minValue(0.1), v.maxValue(1)),
        0.85
      ),
      title: v.optional(v.string()),
    }),
  },
  ({ title, direction, fit, minScale, children }) => {
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
      return <Section title={title}>{children}</Section>;
    }

    const { g, height, liveEdges, width } = layoutGraph(
      uniqueNodes,
      edges,
      direction
    );
    return (
      <Panel>
        {nonEmpty(title) ? (
          <CaptionBar className={CAPTION_TITLE_CLS}>
            <Icon className="h-3.5 w-3.5" name="lucide:workflow" />
            {title}
          </CaptionBar>
        ) : null}
        <GraphViewport
          width={width}
          height={height}
          fit={fit}
          minScale={minScale}
          title={title}
        >
          <svg
            aria-hidden
            className="absolute inset-0"
            height={height}
            width={width}
          >
            {liveEdges.map((e, i) => (
              <EdgePath e={e} edge={g.edge(e.from, e.to, edgeKey(i))} key={i} />
            ))}
          </svg>
          {liveEdges.map((e, i) => (
            <EdgeLabelChip
              e={e}
              edge={g.edge(e.from, e.to, edgeKey(i))}
              key={`label-${i}`}
            />
          ))}
          {uniqueNodes.map((n) => (
            <PlacedNode g={g} key={n.id} n={n} />
          ))}
        </GraphViewport>
        {rest.length > 0 ? <div className="px-4 py-2">{rest}</div> : null}
      </Panel>
    );
  }
);

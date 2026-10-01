import { graphlib, layout } from "@dagrejs/dagre";
import type { EdgeLabel, GraphLabel, NodeLabel } from "@dagrejs/dagre";
import { MarkerType, Position } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";

import { nonEmpty } from "../guards.js";
import { edgeLabelSize, nodeSize } from "./graph-layout.js";
import type { GraphDirection } from "./graph-layout.js";
import type {
  GraphViewSpec,
  InteractiveGraphSpecs,
  InteractiveNodeSpec,
} from "./interactive-graph-specs.js";
import {
  graphIds,
  validateInteractiveSpecs,
} from "./interactive-graph-specs.js";

const DIRECTIONS = { down: "TB", left: "RL", right: "LR", up: "BT" } as const;
const PORTS = {
  down: [Position.Top, Position.Bottom],
  left: [Position.Right, Position.Left],
  right: [Position.Left, Position.Right],
  up: [Position.Bottom, Position.Top],
} as const;

export interface InteractiveNodeData extends Record<string, unknown> {
  dimmed?: boolean;
  label: string;
  sourcePosition: Position;
  spec?: InteractiveNodeSpec;
  targetPosition: Position;
}

export type InteractiveFlowNode = Node<
  InteractiveNodeData,
  "mdxr-node" | "mdxr-group"
>;

interface InteractiveEdgeData extends Record<string, unknown> {
  color?: string;
}

export type InteractiveFlowEdge = Edge<InteractiveEdgeData>;

export interface InteractiveGraphModel {
  edges: InteractiveFlowEdge[];
  nodes: InteractiveFlowNode[];
  specs: InteractiveGraphSpecs;
}

const handlePoint = (
  position: Position,
  width: number,
  height: number
): { x: number; y: number } => {
  switch (position) {
    case Position.Top: {
      return { x: width / 2, y: 0 };
    }
    case Position.Bottom: {
      return { x: width / 2, y: height };
    }
    case Position.Left: {
      return { x: 0, y: height / 2 };
    }
    case Position.Right: {
      return { x: width, y: height / 2 };
    }
    default: {
      return { x: 0, y: 0 };
    }
  }
};

/** Compound Dagre layout establishes group boundaries before SSR or hydration. */
export const interactiveGraphModel = (
  specs: InteractiveGraphSpecs,
  direction: GraphDirection
): InteractiveGraphModel => {
  validateInteractiveSpecs(specs);
  const graph = new graphlib.Graph<GraphLabel, NodeLabel, EdgeLabel>({
    compound: true,
    multigraph: true,
  });
  graph.setGraph({
    marginx: 24,
    marginy: 24,
    nodesep: 28,
    rankdir: DIRECTIONS[direction],
    ranksep: 56,
  });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const group of specs.groups) {
    graph.setNode(group.id, { height: 0, width: 0 });
  }
  for (const node of specs.nodes) {
    graph.setNode(node.id, nodeSize(node));
    if (node.group !== undefined) {
      graph.setParent(node.id, node.group);
    }
  }
  for (const [index, edge] of specs.edges.entries()) {
    graph.setEdge(
      edge.from,
      edge.to,
      nonEmpty(edge.label)
        ? { ...edgeLabelSize(edge.label), labelpos: "c" }
        : {},
      edge.id ?? `edge-${index}`
    );
  }
  layout(graph);
  const [targetPosition, sourcePosition] = PORTS[direction];
  const groups: InteractiveFlowNode[] = specs.groups.map((group) => {
    const placed = graph.node(group.id);
    return {
      data: { label: group.label ?? group.id, sourcePosition, targetPosition },
      draggable: false,
      focusable: false,
      height: placed.height ?? 0,
      id: group.id,
      position: {
        x: (placed.x ?? 0) - (placed.width ?? 0) / 2,
        y: (placed.y ?? 0) - (placed.height ?? 0) / 2,
      },
      selectable: false,
      type: "mdxr-group",
      width: placed.width ?? 0,
      zIndex: -1,
    };
  });
  const nodes: InteractiveFlowNode[] = specs.nodes.map((spec) => {
    const { width, height } = nodeSize(spec);
    const placed = graph.node(spec.id);
    const parent = groups.find((group) => group.id === spec.group);
    return {
      ariaLabel: spec.label ?? spec.id,
      ariaRole: "button",
      data: {
        label: spec.label ?? spec.id,
        sourcePosition,
        spec,
        targetPosition,
      },
      extent: parent === undefined ? undefined : "parent",
      handles: [
        {
          ...handlePoint(targetPosition, width, height),
          id: "in",
          position: targetPosition,
          type: "target",
        },
        {
          ...handlePoint(sourcePosition, width, height),
          id: "out",
          position: sourcePosition,
          type: "source",
        },
      ],
      height,
      id: spec.id,
      parentId: parent?.id,
      position: {
        x: (placed.x ?? 0) - width / 2 - (parent?.position.x ?? 0),
        y: (placed.y ?? 0) - height / 2 - (parent?.position.y ?? 0),
      },
      type: "mdxr-node",
      width,
    };
  });
  const edges: InteractiveFlowEdge[] = specs.edges.map((edge, index) => ({
    data: { color: edge.color },
    focusable: false,
    id: edge.id ?? `edge-${index}`,
    label: edge.label,
    markerEnd: {
      color: "var(--mdxr-graph-edge)",
      type: MarkerType.ArrowClosed,
    },
    selectable: false,
    source: edge.from,
    sourceHandle: "out",
    target: edge.to,
    targetHandle: "in",
    type: "smoothstep",
  }));
  return { edges, nodes: [...groups, ...nodes], specs };
};

/** Explicit edge IDs avoid highlighting unrelated shortcuts between view nodes. */
export const graphViewSelection = (
  view: GraphViewSpec,
  edges: Edge[]
): { edges: Set<string>; nodes: Set<string> } => {
  const nodes = new Set(graphIds(view.nodes));
  const chosenEdges = new Set(graphIds(view.edges));
  if (chosenEdges.size === 0) {
    for (const edge of edges) {
      if (nodes.has(edge.source) && nodes.has(edge.target)) {
        chosenEdges.add(edge.id);
      }
    }
  }
  for (const edge of edges) {
    if (chosenEdges.has(edge.id)) {
      nodes.add(edge.source);
      nodes.add(edge.target);
    }
  }
  return { edges: chosenEdges, nodes };
};

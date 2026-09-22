import { graphlib, layout } from "@dagrejs/dagre";
import type { GraphLabel, NodeLabel, EdgeLabel } from "@dagrejs/dagre";

import type { DataRecord } from "./data.js";
import { display, positive, uniqueIds, words } from "./data.js";
import type { PlotMark, PlotModel } from "./plots.js";
import { PLOT_COLORS } from "./plots.js";

export interface DiagramModel extends PlotModel {
  nodes: DataRecord[];
  edges: DataRecord[];
}
const text = (x: number, y: number, value: string): PlotMark => ({
  kind: "text",
  text: value,
  x,
  y,
});
const color = (index: number): string =>
  PLOT_COLORS[index % PLOT_COLORS.length] ?? "#0284c7";
const positionOf = (node: NodeLabel) => ({
  height: node.height ?? 0,
  width: node.width ?? 0,
  x: node.x ?? 0,
  y: node.y ?? 0,
});
const nodeLabel = (row: DataRecord): string =>
  display(row.label ?? row.name ?? row.id);
const edgeLabel = (row: DataRecord): string =>
  [
    row.label ?? row.event,
    row.guard !== undefined && row.guard !== null
      ? `[${display(row.guard)}]`
      : "",
    row.action !== undefined && row.action !== null
      ? `/ ${display(row.action)}`
      : "",
    row.relation,
  ]
    .map(display)
    .filter(Boolean)
    .join(" ");
const arrow = (x: number, y: number, x2: number, y2: number): PlotMark[] => {
  const angle = Math.atan2(y2 - y, x2 - x);
  return [
    { kind: "line", stroke: "#0284c7", strokeWidth: 1.5, x, x2, y, y2 },
    {
      d: `M ${x2 - 8 * Math.cos(angle - 0.4)} ${y2 - 8 * Math.sin(angle - 0.4)} L ${x2} ${y2} L ${x2 - 8 * Math.cos(angle + 0.4)} ${y2 - 8 * Math.sin(angle + 0.4)}`,
      fill: "none",
      kind: "path",
      stroke: "#0284c7",
      strokeWidth: 1.5,
    },
  ];
};

const validateEdges = (nodes: DataRecord[], edges: DataRecord[]): void => {
  const ids = uniqueIds(nodes);
  for (const edge of edges) {
    for (const key of ["from", "to"]) {
      if (!ids.has(display(edge[key]))) {
        throw new Error(`Diagram: unknown ${key} node ${display(edge[key])}`);
      }
    }
  }
};

const sequence = (nodes: DataRecord[], edges: DataRecord[]): DiagramModel => {
  const width = Math.max(450, nodes.length * 180 + 80);
  const height = 130 + edges.length * 62;
  const xs = new Map(nodes.map((node, i) => [display(node.id), 120 + i * 180]));
  const marks: PlotMark[] = [];
  for (const node of nodes) {
    const x = xs.get(display(node.id)) ?? 0;
    marks.push(
      {
        fill: "#e0f2fe",
        height: 36,
        kind: "rect",
        label: nodeLabel(node),
        width: 140,
        x: x - 70,
        y: 12,
      },
      {
        ...text(x, 35, nodeLabel(node)),
        file: display(node.file),
        fill: "#0c4a6e",
        href: display(node.href),
      },
      { kind: "line", stroke: "#a3a3a3", x, x2: x, y: 50, y2: height - 20 }
    );
  }
  for (const [i, edge] of edges.entries()) {
    const x = xs.get(display(edge.from)) ?? 0;
    const x2 = xs.get(display(edge.to)) ?? 0;
    const y = 85 + i * 62;
    if (x === x2) {
      marks.push(
        ...arrow(x, y, x + 50, y),
        ...arrow(x + 50, y, x + 50, y + 25),
        ...arrow(x + 50, y + 25, x, y + 25),
        text(x + 75, y - 8, edgeLabel(edge))
      );
    } else {
      marks.push(
        ...arrow(x, y, x2, y),
        text((x + x2) / 2, y - 9, edgeLabel(edge))
      );
    }
  }
  return {
    edges,
    height,
    marks,
    nodes,
    rows: edges,
    summary: `${nodes.length} participants · ${edges.length} messages`,
    width,
  };
};

const lanes = (nodes: DataRecord[], edges: DataRecord[]): DiagramModel => {
  const groups = [
    ...new Set(nodes.map((node) => display(node.lane) || "Process")),
  ];
  const width = Math.max(720, nodes.length * 170 + 130);
  const height = groups.length * 130 + 40;
  const marks: PlotMark[] = [];
  const positions = new Map<string, { x: number; y: number }>();
  for (const [i, group] of groups.entries()) {
    marks.push(
      {
        fill: i % 2 ? "#f0f9ff" : "#f5f5f5",
        height: 125,
        kind: "rect",
        width: width - 10,
        x: 5,
        y: 10 + i * 130,
      },
      { ...text(65, 80 + i * 130, group), fill: "#404040" }
    );
  }
  for (const [i, node] of nodes.entries()) {
    positions.set(display(node.id), {
      x: 210 + i * 165,
      y: 75 + groups.indexOf(display(node.lane) || "Process") * 130,
    });
  }
  for (const edge of edges) {
    const from = positions.get(display(edge.from));
    const to = positions.get(display(edge.to));
    if (from && to) {
      marks.push(
        ...arrow(from.x + 55, from.y, to.x - 55, to.y),
        text((from.x + to.x) / 2, (from.y + to.y) / 2 - 10, edgeLabel(edge))
      );
    }
  }
  for (const node of nodes) {
    const pos = positions.get(display(node.id));
    if (!pos) {
      continue;
    }
    marks.push(
      {
        file: display(node.file),
        fill: "#0284c7",
        height: 40,
        href: display(node.href),
        kind: "rect",
        label: nodeLabel(node),
        width: 130,
        x: pos.x - 65,
        y: pos.y - 20,
      },
      {
        ...text(pos.x, pos.y + 4, nodeLabel(node)),
        file: display(node.file),
        fill: "#fff",
        href: display(node.href),
      }
    );
  }
  return {
    edges,
    height,
    marks,
    nodes,
    rows: nodes,
    summary: `${groups.length} lanes · ${nodes.length} steps`,
    width,
  };
};

const mindmap = (nodes: DataRecord[], edges: DataRecord[]): DiagramModel => {
  const [root] = nodes;
  if (!(root !== undefined)) {
    return {
      edges,
      height: 440,
      marks: [],
      nodes,
      rows: [],
      summary: "No data",
      width: 720,
    };
  }
  const positions = new Map([[display(root.id), { depth: 0, x: 360, y: 220 }]]);
  const children = new Map<string, string[]>();
  for (const edge of edges) {
    const items = children.get(display(edge.from)) ?? [];
    items.push(display(edge.to));
    children.set(display(edge.from), items);
  }
  const visit = (
    id: string,
    start: number,
    end: number,
    depth: number
  ): void => {
    const items = children.get(id) ?? [];
    for (const [i, child] of items.entries()) {
      if (positions.has(child)) {
        throw new Error(
          "MindMap: expected a rooted tree without cycles or multiple parents"
        );
      }
      const a = start + ((end - start) * i) / items.length;
      const b = start + ((end - start) * (i + 1)) / items.length;
      const angle = (a + b) / 2;
      positions.set(child, {
        depth,
        x: 360 + Math.cos(angle) * depth * 140,
        y: 220 + Math.sin(angle) * depth * 90,
      });
      visit(child, a, b, depth + 1);
    }
  };
  visit(display(root.id), -Math.PI, Math.PI, 1);
  if (positions.size !== nodes.length) {
    throw new Error(
      "MindMap: every node must be reachable from the first node"
    );
  }
  const xs = [...positions.values()].map((p) => p.x);
  const ys = [...positions.values()].map((p) => p.y);
  const dx = 90 - Math.min(...xs);
  const dy = 40 - Math.min(...ys);
  for (const pos of positions.values()) {
    pos.x += dx;
    pos.y += dy;
  }
  const marks: PlotMark[] = [];
  for (const edge of edges) {
    const a = positions.get(display(edge.from));
    const b = positions.get(display(edge.to));
    if (a && b) {
      marks.push({
        kind: "line",
        stroke: color(b.depth),
        strokeWidth: 2,
        x: a.x,
        x2: b.x,
        y: a.y,
        y2: b.y,
      });
    }
  }
  for (const node of nodes) {
    const p = positions.get(display(node.id));
    if (!p) {
      continue;
    }
    marks.push(
      {
        file: display(node.file),
        fill: color(p.depth),
        height: 36,
        href: display(node.href),
        kind: "rect",
        width: 130,
        x: p.x - 65,
        y: p.y - 18,
      },
      {
        ...text(p.x, p.y + 4, nodeLabel(node)),
        file: display(node.file),
        fill: "#fff",
        href: display(node.href),
      }
    );
  }
  return {
    edges,
    height: Math.max(...ys) - Math.min(...ys) + 80,
    marks,
    nodes,
    rows: nodes,
    summary: `${nodes.length} topics`,
    width: Math.max(...xs) - Math.min(...xs) + 180,
  };
};

type LayoutGraph = graphlib.Graph<GraphLabel, NodeLabel, EdgeLabel>;

const buildLayout = (
  nodes: DataRecord[],
  edges: DataRecord[],
  options: DataRecord
): { graph: LayoutGraph; groups: string[] } => {
  const graph = new graphlib.Graph<GraphLabel, NodeLabel, EdgeLabel>({
    compound: true,
    multigraph: true,
  });
  graph.setGraph({
    marginx: 30,
    marginy: 30,
    nodesep: 35,
    rankdir: options.direction === "down" ? "TB" : "LR",
    ranksep: 80,
  });
  graph.setDefaultEdgeLabel(() => ({}));
  const groups = [
    ...new Set(nodes.map((node) => display(node.group)).filter(Boolean)),
  ];
  const ids = new Set(nodes.map((node) => display(node.id)));
  for (const group of groups) {
    if (ids.has(`group:${group}`)) {
      throw new Error(`Diagram: node id collides with group:${group}`);
    }
    graph.setNode(`group:${group}`, {
      height: 0,
      label: group,
      padding: 20,
      width: 0,
    });
  }
  for (const node of nodes) {
    graph.setNode(display(node.id), {
      height: Boolean(node.note) || Boolean(node.status) ? 62 : 42,
      width: Math.min(280, Math.max(130, nodeLabel(node).length * 8 + 28)),
    });
    const group = display(node.group);
    if (group !== "") {
      graph.setParent(display(node.id), `group:${group}`);
    }
  }
  for (const [i, edge] of edges.entries()) {
    graph.setEdge(
      display(edge.from),
      display(edge.to),
      {
        height: 24,
        label: edgeLabel(edge),
        width: Math.max(30, edgeLabel(edge).length * 7),
      },
      String(i)
    );
  }
  layout(graph);
  return { graph, groups };
};

const affectedNodes = (
  name: string,
  edges: DataRecord[],
  options: DataRecord
): Set<string> => {
  const affected = new Set(words(options.changed));
  if (name !== "ImpactMap") {
    return new Set();
  }
  {
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of edges) {
        if (
          affected.has(display(edge.from)) &&
          !affected.has(display(edge.to))
        ) {
          affected.add(display(edge.to));
          changed = true;
        }
      }
    }
  }
  return affected;
};

const groupMarks = (graph: LayoutGraph, groups: string[]): PlotMark[] => {
  const marks: PlotMark[] = [];
  for (const group of groups) {
    const pos = positionOf(graph.node(`group:${group}`));
    marks.push(
      {
        fill: "#e0f2fe",
        height: pos.height,
        kind: "rect",
        label: group,
        opacity: 0.5,
        width: pos.width,
        x: pos.x - pos.width / 2,
        y: pos.y - pos.height / 2,
      },
      { ...text(pos.x, pos.y - pos.height / 2 + 16, group), fill: "#0c4a6e" }
    );
  }
  return marks;
};

const edgeMarks = (graph: LayoutGraph, edges: DataRecord[]): PlotMark[] => {
  const marks: PlotMark[] = [];
  for (const [i, edge] of edges.entries()) {
    const pos = graph.edge(display(edge.from), display(edge.to), String(i));
    const points = pos.points ?? [];
    marks.push({
      d: `M ${points.map((p) => `${p.x},${p.y}`).join(" L ")}`,
      fill: "none",
      kind: "path",
      label: edgeLabel(edge),
      stroke: "#0284c7",
      strokeWidth: 1.5,
    });
    const end = points.at(-1);
    const prev = points.at(-2);
    if (end && prev) {
      marks.push(...arrow(prev.x, prev.y, end.x, end.y));
    }
    if (edgeLabel(edge)) {
      marks.push(text(pos.x ?? 0, (pos.y ?? 0) - 5, edgeLabel(edge)));
    }
  }
  return marks;
};

const nodeMarks = (
  graph: LayoutGraph,
  name: string,
  nodes: DataRecord[],
  affected: Set<string>
): PlotMark[] => {
  const marks: PlotMark[] = [];
  for (const node of nodes) {
    const id = display(node.id);
    const pos = positionOf(graph.node(id));
    const failed = ["down", "fail", "degraded", "blocked"].includes(
      display(node.status)
    );
    const fill = affected.has(id) || failed ? "#b45309" : "#0369a1";
    if (name === "DecisionTree" && Boolean(node.condition)) {
      marks.push({
        d: `M ${pos.x} ${pos.y - pos.height / 2 - 8} L ${pos.x + pos.width / 2} ${pos.y} L ${pos.x} ${pos.y + pos.height / 2 + 8} L ${pos.x - pos.width / 2} ${pos.y} Z`,
        fill,
        kind: "path",
        label: display(node.condition),
      });
    } else {
      marks.push({
        file: display(node.file),
        fill,
        height: pos.height,
        href: display(node.href),
        kind: "rect",
        label: nodeLabel(node),
        width: pos.width,
        x: pos.x - pos.width / 2,
        y: pos.y - pos.height / 2,
      });
    }
    marks.push({
      ...text(
        pos.x,
        pos.y + (Boolean(node.note) || Boolean(node.status) ? -4 : 4),
        nodeLabel(node)
      ),
      file: display(node.file),
      fill: "#fff",
      href: display(node.href),
    });
    if (Boolean(node.note) || Boolean(node.status)) {
      marks.push({
        ...text(
          pos.x,
          pos.y + 16,
          [node.note, node.status].map(display).filter(Boolean).join(" · ")
        ),
        fill: "#e0f2fe",
      });
    }
  }
  return marks;
};

export const diagramModel = (
  name: string,
  nodes: DataRecord[],
  edges: DataRecord[],
  options: DataRecord = {}
): DiagramModel => {
  validateEdges(nodes, edges);
  if (name === "SequenceDiagram") {
    return sequence(nodes, edges);
  }
  if (name === "Swimlane") {
    return lanes(nodes, edges);
  }
  if (name === "MindMap") {
    return mindmap(nodes, edges);
  }
  const { graph, groups } = buildLayout(nodes, edges, options);
  const affected = affectedNodes(name, edges, options);
  const marks = [
    ...groupMarks(graph, groups),
    ...edgeMarks(graph, edges),
    ...nodeMarks(graph, name, nodes, affected),
  ];
  return {
    edges,
    height: Math.max(100, graph.graph().height ?? 0),
    marks,
    nodes,
    rows: nodes.map((node) => ({
      ...node,
      ...(name === "ImpactMap"
        ? { affected: affected.has(display(node.id)) }
        : {}),
    })),
    summary: `${nodes.length} nodes · ${edges.length} edges${name === "ImpactMap" ? ` · ${affected.size} affected` : ""}`,
    width: Math.max(240, graph.graph().width ?? 0),
  };
};

export const flameModel = (rows: DataRecord[]): PlotModel => {
  const byId = uniqueIds(rows);
  const children = new Map<string, DataRecord[]>();
  for (const row of rows) {
    const parent = display(row.parent);
    if (parent && !byId.has(parent)) {
      throw new Error(`Flamegraph: unknown parent ${parent}`);
    }
    const list = children.get(parent) ?? [];
    list.push(row);
    children.set(parent, list);
  }
  const visited = new Set<string>();
  const marks: PlotMark[] = [];
  const roots = children.get("") ?? [];
  const total = roots.reduce(
    (sum, row) => sum + positive(row.value, "inclusive value"),
    0
  );
  let maxDepth = 0;
  const result: DataRecord[] = [];
  const draw = (siblings: DataRecord[], start: number, depth: number): void => {
    let offset = start;
    for (const row of siblings) {
      const id = display(row.id);
      if (visited.has(id)) {
        throw new Error("Flamegraph: cyclic hierarchy");
      }
      visited.add(id);
      maxDepth = Math.max(maxDepth, depth);
      const value = positive(row.value, "inclusive value");
      const descendants = children.get(id) ?? [];
      const childTotal = descendants.reduce(
        (sum, child) => sum + positive(child.value, "value"),
        0
      );
      if (childTotal > value + 1e-9) {
        throw new Error(
          `Flamegraph: child totals exceed inclusive value for ${id}`
        );
      }
      const width = total ? (value / total) * 680 : 0;
      marks.push({
        fill: color(depth),
        height: 29,
        kind: "rect",
        label: `${nodeLabel(row)}: total ${value}, self ${value - childTotal}`,
        width,
        x: 20 + offset,
        y: 20 + depth * 32,
      });
      if (width > 55) {
        marks.push({
          ...text(20 + offset + width / 2, 40 + depth * 32, nodeLabel(row)),
          fill: "#fff",
        });
      }
      result.push({ ...row, self: value - childTotal });
      draw(descendants, offset, depth + 1);
      offset += width;
    }
  };
  draw(roots, 0, 0);
  if (visited.size !== rows.length) {
    throw new Error("Flamegraph: cyclic hierarchy");
  }
  return {
    height: 65 + maxDepth * 32,
    marks,
    rows: result,
    summary: `Inclusive total ${total}`,
    width: 720,
  };
};

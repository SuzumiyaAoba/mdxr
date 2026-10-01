import type { ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren, parseProps } from "../define.js";
import { isEl } from "./children.js";
import { Edge, EDGE_SCHEMA, Node, NODE_SCHEMA } from "./graph-specs.js";
import type { EdgeSpec, NodeSpec } from "./graph-specs.js";

const ID = v.pipe(v.string(), v.nonEmpty());
const GROUP_SCHEMA = v.looseObject({ id: ID, label: v.optional(v.string()) });
const VIEW_SCHEMA = v.looseObject({
  edges: v.optional(v.string(), ""),
  icon: v.optional(v.string()),
  id: ID,
  label: v.optional(v.string()),
  nodes: v.optional(v.string(), ""),
});

export const GraphGroup = defineComponent(
  {
    description:
      "InteractiveGraph のシステム境界。id は必須、label は表示名。子に既存の <Node> を置く。グループの入れ子は非対応",
    schema: GROUP_SCHEMA,
  },
  ({ id, label, children }) => (
    <section aria-label={label ?? id}>{children}</section>
  )
);

export const GraphView = defineComponent(
  {
    description:
      "InteractiveGraph の経路切り替え。id は all 以外の一意な名前。label/icon で縦タブの表示を調整。nodes/edges は空白またはカンマ区切りの ID。edges で明示した経路の両端も強調。nodes だけなら指定ノード間のエッジを強調。children は経路の説明",
    schema: VIEW_SCHEMA,
  },
  ({ id, label, children }) => (
    <section aria-label={label ?? id}>{children}</section>
  )
);

export interface InteractiveNodeSpec extends NodeSpec {
  body?: ReactNode;
  group?: string;
}

export interface GraphViewSpec extends v.InferOutput<typeof VIEW_SCHEMA> {
  body?: ReactNode;
}

export interface InteractiveGraphSpecs {
  edges: EdgeSpec[];
  groups: v.InferOutput<typeof GROUP_SCHEMA>[];
  nodes: InteractiveNodeSpec[];
  rest: ReactNode[];
  views: GraphViewSpec[];
}

/** Keep author-provided descriptions as React content, never executable data. */
export const collectInteractiveSpecs = (
  children: ReactNode
): InteractiveGraphSpecs => {
  const specs: InteractiveGraphSpecs = {
    edges: [],
    groups: [],
    nodes: [],
    rest: [],
    views: [],
  };
  const collect = (content: ReactNode, group?: string): void => {
    for (const child of flattenChildren(content)) {
      if (isEl(child, Node)) {
        const node = parseProps(NODE_SCHEMA, child.props, "Node");
        specs.nodes.push({ ...node, body: child.props.children, group });
      } else if (isEl(child, Edge)) {
        specs.edges.push(parseProps(EDGE_SCHEMA, child.props, "Edge"));
      } else if (isEl(child, GraphView)) {
        specs.views.push({
          ...parseProps(VIEW_SCHEMA, child.props, "GraphView"),
          body: child.props.children,
        });
      } else if (isEl(child, GraphGroup)) {
        if (group !== undefined) {
          throw new Error(
            "InteractiveGraph: nested GraphGroup is not supported"
          );
        }
        const parent = parseProps(GROUP_SCHEMA, child.props, "GraphGroup");
        specs.groups.push(parent);
        collect(child.props.children, parent.id);
      } else {
        specs.rest.push(child);
      }
    }
  };
  collect(children);
  return specs;
};

export const graphIds = (value: string): string[] =>
  value.split(/[\s,]+/u).filter(Boolean);

const unique = (ids: string[], kind: string): Set<string> => {
  const result = new Set<string>();
  for (const id of ids) {
    if (id.trim() === "" || result.has(id)) {
      throw new Error(
        `InteractiveGraph: invalid or duplicate ${kind} ID "${id}"`
      );
    }
    result.add(id);
  }
  return result;
};

const requireIds = (ids: string[], known: Set<string>, kind: string): void => {
  for (const id of ids) {
    if (!known.has(id)) {
      throw new Error(`InteractiveGraph: unknown ${kind} ID "${id}"`);
    }
  }
};

export const validateInteractiveSpecs = (
  specs: InteractiveGraphSpecs
): void => {
  const nodes = unique(
    specs.nodes.map((node) => node.id),
    "node"
  );
  unique([...nodes, ...specs.groups.map((group) => group.id)], "node/group");
  const edges = unique(
    specs.edges.map((edge, index) => edge.id ?? `edge-${index}`),
    "edge"
  );
  const views = unique(
    specs.views.map((view) => view.id),
    "view"
  );
  if (views.has("all")) {
    throw new Error('InteractiveGraph: view ID "all" is reserved');
  }
  for (const edge of specs.edges) {
    requireIds([edge.from, edge.to], nodes, "node");
  }
  for (const view of specs.views) {
    requireIds(graphIds(view.nodes), nodes, "view node");
    requireIds(graphIds(view.edges), edges, "view edge");
  }
};

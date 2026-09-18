import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { nonEmpty } from "../guards.js";
import { FILE_LINK_PROPS } from "./attrs.js";
import { isEl } from "./children.js";
import { DEP_KINDS } from "./deps.js";
import { fileIcon } from "./file-icon.js";
import { hasIcon, Icon } from "./icon.js";
import { STATUS_ICONS, STATUSES } from "./status-badge.js";
import { TEXT } from "./tones.js";

/**
 * `<Graph>` child specs: the `Node`/`Edge` prop schemas, their standalone
 * (outside-Graph) renderings, and `collectSpecs`, which splits a Graph's
 * children into node specs, edge specs, and leftover content.
 */

export const NODE_SCHEMA = v.looseObject({
  ...FILE_LINK_PROPS,
  external: v.optional(v.union([v.boolean(), v.string()])),
  icon: v.optional(v.string()),
  id: v.string(),
  label: v.optional(v.string()),
  note: v.optional(v.string()),
  status: v.optional(v.picklist(STATUSES)),
});

export const EDGE_SCHEMA = v.looseObject({
  from: v.string(),
  kind: v.optional(v.picklist(DEP_KINDS)),
  label: v.optional(v.string()),
  to: v.string(),
});

export type NodeSpec = v.InferOutput<typeof NODE_SCHEMA>;
export type EdgeSpec = v.InferOutput<typeof EDGE_SCHEMA>;

export const Node = defineComponent(
  {
    description:
      "Graph のノード。<Graph> の子として使う。id は必須、label/note/icon で表示を調整。path/lines で実ファイルへのエディタリンク、status でステータス点、external で外部依存スタイル",
    schema: NODE_SCHEMA,
  },
  // Standalone use (outside <Graph>): a small chip so misplaced nodes still render.
  ({ id, label, icon, path, status }): ReactElement => (
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
  ({ from, to, label, kind }): ReactElement => (
    <div
      className={`not-prose flex items-center gap-2 py-0.5 font-mono text-xs ${TEXT.muted}`}
    >
      <span>{from}</span>
      <Icon className="h-3 w-3" name="lucide:arrow-right" />
      <span>{to}</span>
      {nonEmpty(kind) ? <span className="opacity-70">{kind}</span> : null}
      {nonEmpty(label) ? <span className="opacity-70">{label}</span> : null}
    </div>
  )
);

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

/** Splits children into <Node>/<Edge> specs and leftover content. */
export const collectSpecs = (
  children: ReactNode
): { edges: EdgeSpec[]; nodes: NodeSpec[]; rest: ReactNode[] } => {
  const nodes: NodeSpec[] = [];
  const edges: EdgeSpec[] = [];
  const rest: ReactNode[] = [];
  for (const child of flattenChildren(children)) {
    if (isEl(child, Node)) {
      nodes.push(parseSpec(NODE_SCHEMA, child.props, "Node"));
    } else if (isEl(child, Edge)) {
      edges.push(parseSpec(EDGE_SCHEMA, child.props, "Edge"));
    } else {
      rest.push(child);
    }
  }
  return { edges, nodes, rest };
};

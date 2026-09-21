import * as v from "valibot";

import { defineComponent } from "../define.js";
import {
  display,
  parseJson,
  records,
  isDataRecord as isRecord,
} from "../extended/data.js";
import { diagramModel, flameModel } from "../extended/diagrams.js";
import {
  bundleModel,
  queryPlanModel,
  dependencyMatrixModel,
} from "../extended/profiles.js";
import { rowsFrom } from "./data-children.js";
import { DATA_PROPS } from "./data-props.js";
import { DataGrid } from "./data-view.js";
import { PlotView } from "./plot-view.js";

export const DIAGRAM_NAMES = [
  "ImpactMap",
  "DataLineage",
  "SequenceDiagram",
  "StateDiagram",
  "Swimlane",
  "Architecture",
  "DecisionTree",
  "MindMap",
  "ServiceTopology",
] as const;

const diagram = (name: string, description: string) =>
  defineComponent(
    {
      description,
      schema: v.looseObject({
        edges: v.optional(v.string(), "[]"),
        id: v.optional(v.string()),
        nodes: v.string(),
        options: v.optional(v.string(), "{}"),
        title: v.optional(v.string()),
      }),
    },
    (props) => {
      const options: unknown = parseJson(props.options, "options");
      if (!isRecord(options)) {
        throw new Error("Diagram: options must be an object");
      }
      const nodes = records(parseJson(props.nodes), "nodes");
      const edges = records(parseJson(props.edges), "edges");
      const model = diagramModel(name, nodes, edges, options);
      return (
        <>
          <PlotView title={props.title ?? name} id={props.id} model={model} />
          <details className="my-3">
            <summary>Relationships</summary>
            <DataGrid rows={edges} />
          </details>
        </>
      );
    }
  );
export const ImpactMap = diagram(
  "ImpactMap",
  "Directed impact propagation from options.changed node ids, with affected nodes highlighted."
);
export const DataLineage = diagram(
  "DataLineage",
  "Source/transform/destination graph. Nodes accept group, file, href and note; edges label transformations."
);
export const SequenceDiagram = diagram(
  "SequenceDiagram",
  "Participant lifelines and ordered messages; edges may target the sender itself."
);
export const StateDiagram = diagram(
  "StateDiagram",
  "State transitions labelled by event, guard and action."
);
export const Swimlane = diagram(
  "Swimlane",
  "Process steps grouped by lane; edge labels explain handoffs."
);
export const Architecture = diagram(
  "Architecture",
  "Compound architecture graph with group boundaries, linked nodes and labelled connections."
);
export const DecisionTree = diagram(
  "DecisionTree",
  "Decision graph; condition nodes use diamonds, edge labels describe branches."
);
export const MindMap = diagram(
  "MindMap",
  "Radial rooted topic tree. The first node is the root; rejects cycles/disconnected topics."
);
export const ServiceTopology = diagram(
  "ServiceTopology",
  "Service dependencies grouped by environment; degraded/down/blocked status is highlighted."
);

export const EntityRelations = defineComponent(
  {
    description:
      "Entity relation diagram from field records: table,name,type,fk (table.field),relation. Shared tables are grouped.",
    schema: v.looseObject(DATA_PROPS),
  },
  (props) => {
    const fields = rowsFrom(props);
    const tables = [...new Set(fields.map((field) => display(field.table)))];
    const nodes = tables.map((table) => ({
      id: table,
      label: table,
      note: fields
        .filter((field) => field.table === table)
        .map((field) => `${display(field.name)}: ${display(field.type)}`)
        .join(", "),
    }));
    const edges = fields
      .filter((field) => Boolean(field.fk))
      .map((field) => ({
        from: field.table,
        label: `${display(field.name)} → ${display(field.fk)}`,
        relation: field.relation,
        to: display(field.fk).split(".")[0],
      }));
    return (
      <PlotView
        title={props.title ?? "Entity relations"}
        id={props.id}
        model={diagramModel("EntityRelations", nodes, edges)}
      />
    );
  }
);

export const DependencyMatrix = defineComponent(
  {
    description:
      "Adjacency heatmap from from/to/value edge records, including absent relationships.",
    schema: v.looseObject(DATA_PROPS),
  },
  (props) => (
    <PlotView
      title={props.title ?? "DependencyMatrix"}
      id={props.id}
      model={dependencyMatrixModel(rowsFrom(props))}
    />
  )
);

export const Flamegraph = defineComponent(
  {
    description:
      "Hierarchical profile from id,parent,value inclusive timings. Width represents inclusive time; data table includes self time.",
    schema: v.looseObject(DATA_PROPS),
  },
  (props) => (
    <PlotView
      title={props.title ?? "Flamegraph"}
      id={props.id}
      model={flameModel(rowsFrom(props))}
    />
  )
);

export const BundleReport = defineComponent(
  {
    description:
      "Bundle composition from id,parent,value byte counts with gzip, before and reason fields. Leaf sizes roll up to parent totals.",
    schema: v.looseObject(DATA_PROPS),
  },
  (props) => (
    <PlotView
      title={props.title ?? "BundleReport"}
      id={props.id}
      model={bundleModel(rowsFrom(props))}
    />
  )
);

export const QueryPlan = defineComponent(
  {
    description:
      "Database plan nodes: id,parent,operation,estimatedRows,actualRows,time. Shows estimate error and highlights costly operations.",
    schema: v.looseObject(DATA_PROPS),
  },
  (props) => (
    <PlotView
      title={props.title ?? "QueryPlan"}
      id={props.id}
      model={queryPlanModel(rowsFrom(props))}
    />
  )
);

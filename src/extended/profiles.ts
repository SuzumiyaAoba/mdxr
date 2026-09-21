import type { DataRecord } from "./data.js";
import { display, numberValue, percentage, positive } from "./data.js";
import { diagramModel } from "./diagrams.js";
import type { PlotModel } from "./plots.js";
import { plotModel } from "./plots.js";

export const bundleModel = (rows: DataRecord[]): PlotModel => {
  const model = plotModel("Sunburst", rows);
  const total = model.rows
    .filter((row) => !display(row.parent))
    .reduce((sum, row) => sum + numberValue(row.total, "total", 0), 0);
  return {
    ...model,
    rows: model.rows.map((row) => ({
      ...row,
      delta:
        row.before === undefined
          ? ""
          : numberValue(row.total) - numberValue(row.before),
      share: percentage(numberValue(row.total), total),
    })),
  };
};

export const queryPlanModel = (rows: DataRecord[]): PlotModel => {
  const max = Math.max(0, ...rows.map((row) => positive(row.time, "time", 0)));
  const nodes = rows.map((row) => ({
    ...row,
    label: display(row.operation ?? row.id),
    note: `${display(row.time)} ms · ${display(row.actualRows)} rows`,
    status:
      numberValue(row.time, "time", 0) === max && max > 0 ? "degraded" : "ok",
  }));
  const edges = rows
    .filter((row) => display(row.parent) !== "")
    .map((row) => ({ from: row.parent, to: row.id }));
  const data = rows.map((row) => {
    let estimateRatio: number | string = "";
    if (row.estimatedRows !== undefined && row.actualRows !== undefined) {
      const estimated = positive(row.estimatedRows, "estimatedRows");
      const actual = positive(row.actualRows, "actualRows");
      estimateRatio = estimated === 0 ? "undefined" : actual / estimated;
    }
    return { ...row, estimateRatio };
  });
  return {
    ...diagramModel("QueryPlan", nodes, edges, { direction: "down" }),
    rows: data,
  };
};

export const dependencyMatrixModel = (edges: DataRecord[]): PlotModel => {
  const names = [
    ...new Set(edges.flatMap((edge) => [display(edge.from), display(edge.to)])),
  ];
  const rows = names.flatMap((from) =>
    names.map((to) => ({
      value: edges
        .filter((edge) => edge.from === from && edge.to === to)
        .reduce((sum, edge) => sum + positive(edge.value, "value", 1), 0),
      x: to,
      y: from,
    }))
  );
  return plotModel("Heatmap", rows);
};

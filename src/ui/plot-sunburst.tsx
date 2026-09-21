import { createPlot } from "./plot-factory.js";

export const Sunburst = createPlot(
  "Sunburst",
  "Hierarchical id/parent/value data; leaf values determine ancestor totals."
);

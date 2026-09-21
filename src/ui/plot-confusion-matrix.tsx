import { createPlot } from "./plot-factory.js";

export const ConfusionMatrix = createPlot(
  "ConfusionMatrix",
  "Actual/predicted class counts with overall accuracy."
);

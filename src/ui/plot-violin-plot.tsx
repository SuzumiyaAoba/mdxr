import { createPlot } from "./plot-factory.js";

export const ViolinPlot = createPlot(
  "ViolinPlot",
  "Gaussian kernel densities for named values arrays; options.bandwidth tunes smoothing."
);

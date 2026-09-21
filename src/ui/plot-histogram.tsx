import { createPlot } from "./plot-factory.js";

export const Histogram = createPlot(
  "Histogram",
  "Distribution of value observations; options.bins sets the bin count."
);

import type { ReactElement } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { attrTrue, BOOLISH_PROP } from "./attrs.js";
import { CODE_CHIP_CLS } from "./bits.js";
import { CHART_TONES } from "./chart.js";

/**
 * Named data series shared by <LineChart> and <Radar>: `values` is a
 * comma-separated number list aligned with the chart's `labels`/`axes`.
 */

export const SERIES_SCHEMA = v.looseObject({
  dash: BOOLISH_PROP,
  name: v.string(),
  tone: v.optional(v.picklist(CHART_TONES)),
  values: v.string(),
});

export type SeriesSpec = v.InferOutput<typeof SERIES_SCHEMA>;

export const Series = defineComponent(
  {
    description:
      'データ系列。<LineChart>/<Radar> の子。name/values は必須 (values="12,8,4" のカンマ区切り)、tone で色、dash で破線',
    schema: SERIES_SCHEMA,
  },
  // Standalone use: a `name values` chip so misplaced series still render.
  ({ name, values, dash }): ReactElement => (
    <span className={`font-mono ${CODE_CHIP_CLS}`}>
      {name}
      <span className="opacity-70">{values}</span>
      {attrTrue(dash) ? <span className="opacity-70">dash</span> : null}
    </span>
  )
);

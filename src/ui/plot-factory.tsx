import { useContext } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { parseJson, isDataRecord as isRecord } from "../extended/data.js";
import type { PlotName } from "../extended/plots.js";
import { plotModel } from "../extended/plots.js";
import { rowsFrom } from "./data-children.js";
import {
  FilterContext,
  PlotScaleContext,
  matchesFilters,
} from "./data-context.js";
import { DATA_PROPS } from "./data-props.js";
import { PlotView } from "./plot-view.js";

export const createPlot = (name: PlotName, description: string) =>
  defineComponent(
    {
      description,
      schema: v.looseObject({
        ...DATA_PROPS,
        options: v.optional(v.string(), "{}"),
      }),
    },
    (props) => {
      const filters = useContext(FilterContext);
      const scale = useContext(PlotScaleContext);
      const options: unknown = parseJson(props.options, "options");
      if (!isRecord(options)) {
        throw new Error(`${name}: options must be an object`);
      }
      return (
        <PlotView
          title={props.title ?? name}
          id={props.id}
          model={plotModel(
            name,
            rowsFrom(props).filter((row) => matchesFilters(row, filters)),
            { ...options, ...scale }
          )}
        />
      );
    }
  );

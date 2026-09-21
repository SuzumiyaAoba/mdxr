import { isValidElement, useMemo } from "react";
import type { ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { numberValue, numbers } from "../extended/data.js";
import { rowsFrom } from "./data-children.js";
import { PlotScaleContext } from "./data-context.js";
import { DataPanel } from "./data-view.js";

export const SmallMultiples = defineComponent(
  {
    description:
      "Grid of extended plots sharing numeric min/max bounds. Child plots use data/options; labels and palette remain shared.",
    schema: v.looseObject({
      columns: v.optional(v.picklist(["2", "3"]), "2"),
      max: v.optional(v.string()),
      min: v.optional(v.string()),
      title: v.optional(v.string()),
    }),
  },
  ({ title, min, max, columns, children }) => {
    const charts = flattenChildren(children).filter((child) =>
      isValidElement<{ data?: string; children?: ReactNode; options?: string }>(
        child
      )
    );
    const values = charts.flatMap((child) => {
      if (!isValidElement<{ data?: string; children?: ReactNode }>(child)) {
        return [];
      }
      return rowsFrom(child.props).flatMap((row) =>
        row.values !== undefined && row.values !== null
          ? numbers(row.values)
          : ["value", "before", "after", "low", "high"]
              .filter((key) => row[key] !== undefined)
              .map((key) => numberValue(row[key]))
      );
    });
    const lower = numberValue(min, "min", Math.min(...values, 0));
    const upper = numberValue(max, "max", Math.max(...values, 1));
    const scale = useMemo(() => ({ max: upper, min: lower }), [upper, lower]);
    return (
      <DataPanel
        title={title ?? "Small multiples"}
        summary={`Shared scale ${lower}–${upper}`}
      >
        <div
          className={`grid gap-4 px-4 ${columns === "3" ? "lg:grid-cols-3" : "md:grid-cols-2"}`}
        >
          <PlotScaleContext.Provider value={scale}>
            {children}
          </PlotScaleContext.Provider>
        </div>
      </DataPanel>
    );
  }
);

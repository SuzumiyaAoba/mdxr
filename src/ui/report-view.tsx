import * as v from "valibot";

import { defineComponent } from "../define.js";
import { parseJson, isDataRecord as isRecord } from "../extended/data.js";
import { REPORT_SPECS, reportModel } from "../extended/reports.js";
import { dataNarrative, rowsFrom } from "./data-children.js";
import { DATA_PROPS } from "./data-props.js";
import { DataPanel } from "./data-view.js";
import { TableControls } from "./table-controls.js";

export const createReport = (name: string) =>
  defineComponent(
    {
      description: REPORT_SPECS[name]?.description,
      schema: v.looseObject({
        ...DATA_PROPS,
        options: v.optional(v.string(), "{}"),
      }),
    },
    (props) => {
      const options: unknown = parseJson(props.options, "options");
      if (!isRecord(options)) {
        throw new Error(`${name}: options must be an object`);
      }
      const model = reportModel(name, rowsFrom(props), options);
      return (
        <DataPanel
          title={props.title ?? name}
          id={props.id}
          summary={model.summary}
        >
          {model.rows.length ? (
            <TableControls
              rows={model.rows}
              columns={
                props.columns !== undefined && props.columns !== ""
                  ? props.columns.split(",").map((key) => key.trim())
                  : model.columns
              }
              filterColumns={model.columns.filter((key) =>
                ["status", "level", "severity", "environment"].includes(key)
              )}
            />
          ) : null}
          <div className="prose dark:prose-invert max-w-none px-4">
            {props.data === undefined
              ? dataNarrative(props.children)
              : props.children}
          </div>
        </DataPanel>
      );
    }
  );

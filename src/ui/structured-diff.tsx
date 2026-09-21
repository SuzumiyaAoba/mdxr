import * as v from "valibot";

import { defineComponent } from "../define.js";
import { parseJson } from "../extended/data.js";
import { comparisonModel } from "../extended/differences.js";
import { DataPanel } from "./data-view.js";
import { TableControls } from "./table-controls.js";

const diff = (kind: string, description: string) =>
  defineComponent(
    {
      description,
      schema: v.looseObject({
        after: v.string(),
        before: v.string(),
        id: v.optional(v.string()),
        rowKey: v.optional(v.string(), "id"),
        title: v.optional(v.string()),
      }),
    },
    (props) => {
      const before: unknown = parseJson(props.before, "before");
      const after: unknown = parseJson(props.after, "after");
      const rows = comparisonModel(kind, before, after, props.rowKey);
      const columns = [...new Set(rows.flatMap(Object.keys))];
      return (
        <DataPanel
          title={props.title ?? kind}
          id={props.id}
          summary={`${rows.length} changes`}
        >
          <TableControls
            rows={rows}
            columns={columns}
            filterColumns={columns.filter(
              (key) => key === "change" || key === "compatibility"
            )}
          />
          {props.children}
        </DataPanel>
      );
    }
  );

export const JsonDiff = diff(
  "JsonDiff",
  "Structural JSON comparison using JSON Pointer paths; distinguishes missing and null."
);
export const ConfigDiff = diff(
  "ConfigDiff",
  "Effective configuration comparison with optional named override layers and value provenance."
);
export const ApiDiff = diff(
  "ApiDiff",
  "API contract differences with conservative breaking-change flags; array records use rowKey."
);
export const SchemaDiff = diff(
  "SchemaDiff",
  "Database schema record changes, removals and stricter constraints; array records use rowKey."
);
export const DatasetDiff = diff(
  "DatasetDiff",
  "Join datasets by rowKey, reject duplicate keys, compare added/removed rows and changed cells."
);

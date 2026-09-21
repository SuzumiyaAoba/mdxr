import { isValidElement, useState } from "react";
import type { ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import type { DataRecord } from "../extended/data.js";
import {
  columnsOf,
  csvOf,
  display,
  numberValue,
  words,
} from "../extended/data.js";
import { attrFalse } from "./attrs.js";
import { rowsFrom } from "./data-children.js";
import { FilterContext } from "./data-context.js";
import { downloadText } from "./data-download.js";
import {
  DATA_BUTTON,
  DATA_INPUT,
  DATA_PROPS,
  INTERACTIVE_DATA_PROPS,
} from "./data-props.js";
import { DataPanel } from "./data-view.js";
import { TableControls } from "./table-controls.js";

export const DataTable = defineComponent(
  {
    description:
      "Sortable, searchable, filterable table from JSON, CSV or a Markdown table. Exports the filtered result.",
    schema: v.looseObject({
      ...INTERACTIVE_DATA_PROPS,
      filters: v.optional(v.string()),
    }),
  },
  (props) => {
    const rows = rowsFrom(props);
    const size = numberValue(props.pageSize, "pageSize", 10);
    if (!Number.isInteger(size) || size < 1) {
      throw new Error("DataTable: pageSize must be a positive integer");
    }
    return (
      <DataPanel title={props.title} id={props.id}>
        <TableControls
          rows={rows}
          columns={columnsOf(rows, props.columns)}
          pageSize={size}
          searchable={!attrFalse(props.searchable)}
          filterColumns={words(props.filters)}
        />
      </DataPanel>
    );
  }
);

const childRows = (children: ReactNode): DataRecord[] =>
  flattenChildren(children).flatMap((child) => {
    if (!isValidElement<{ data?: string; children?: ReactNode }>(child)) {
      return [];
    }
    return [...rowsFrom(child.props), ...childRows(child.props.children)];
  });

export const FilterPanel = defineComponent(
  {
    description:
      "Shared categorical filters for descendant data tables/reports; fields is a comma-separated list.",
    schema: v.looseObject({ ...DATA_PROPS, fields: v.string() }),
  },
  (props) => {
    const [filters, setFilters] = useState<Record<string, string>>({});
    const rows =
      props.data !== undefined && props.data !== ""
        ? rowsFrom(props)
        : childRows(props.children);
    return (
      <DataPanel title={props.title ?? "Filters"} id={props.id}>
        <div className="flex flex-wrap gap-3 p-3">
          {words(props.fields).map((field) => (
            <label className="grid gap-1 text-sm" key={field}>
              {field}
              <select
                aria-label={field}
                className={DATA_INPUT}
                value={filters[field] ?? ""}
                onChange={(event) => {
                  setFilters({ ...filters, [field]: event.target.value });
                }}
              >
                <option value="">All</option>
                {[...new Set(rows.map((row) => display(row[field])))]
                  .filter(Boolean)
                  .map((value) => (
                    <option key={value}>{value}</option>
                  ))}
              </select>
            </label>
          ))}
          <button
            className={DATA_BUTTON}
            type="button"
            onClick={() => {
              setFilters({});
            }}
          >
            Reset filters
          </button>
        </div>
        <FilterContext.Provider value={filters}>
          {props.children}
        </FilterContext.Provider>
      </DataPanel>
    );
  }
);

export const DownloadData = defineComponent(
  {
    description: "Download structured data as CSV or JSON.",
    schema: v.looseObject({
      ...DATA_PROPS,
      filename: v.optional(v.string(), "data"),
      output: v.optional(v.picklist(["csv", "json"]), "csv"),
    }),
  },
  (props) => {
    const rows = rowsFrom(props);
    return (
      <button
        className={DATA_BUTTON}
        type="button"
        onClick={() => {
          downloadText(
            props.output === "csv"
              ? csvOf(rows, columnsOf(rows, props.columns))
              : JSON.stringify(rows, null, 2),
            `${props.filename}.${props.output}`,
            props.output === "csv"
              ? "text/csv;charset=utf-8"
              : "application/json"
          );
        }}
      >
        {props.title ?? `Download ${props.output.toUpperCase()}`}
      </button>
    );
  }
);

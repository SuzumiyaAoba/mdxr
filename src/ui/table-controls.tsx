import { useContext, useId, useState } from "react";

import type { DataRecord } from "../extended/data.js";
import { csvOf, display } from "../extended/data.js";
import { FilterContext, matchesFilters, useHydrated } from "./data-context.js";
import { downloadText } from "./data-download.js";
import { DATA_BUTTON, DATA_INPUT } from "./data-props.js";
import { DataGrid } from "./data-view.js";

const EMPTY_COLUMNS: string[] = [];
const sortDirection = (
  sort: { column: string; descending: boolean },
  column: string
): "ascending" | "descending" | "none" => {
  if (sort.column !== column) {
    return "none";
  }
  return sort.descending ? "descending" : "ascending";
};
const SORT_ICONS = { ascending: "↑", descending: "↓", none: "↕" };

const compareValues = (a: unknown, b: unknown): number => {
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return display(a).localeCompare(display(b), "en", { numeric: true });
};

export const TableControls = ({
  rows,
  columns,
  pageSize = 10,
  searchable = true,
  filterColumns = EMPTY_COLUMNS,
}: {
  rows: DataRecord[];
  columns: string[];
  pageSize?: number;
  searchable?: boolean;
  filterColumns?: string[];
}) => {
  const id = useId();
  const hydrated = useHydrated();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const externalFilters = useContext(FilterContext);
  const [sort, setSort] = useState({ column: "", descending: false });
  const [page, setPage] = useState(0);
  const filtered = rows.filter(
    (row) =>
      matchesFilters(row, externalFilters) &&
      matchesFilters(row, filters) &&
      columns.some((key) =>
        display(row[key]).toLowerCase().includes(query.toLowerCase())
      )
  );
  const sorted = sort.column
    ? filtered.toSorted(
        (a, b) =>
          compareValues(a[sort.column], b[sort.column]) *
          (sort.descending ? -1 : 1)
      )
    : filtered;
  const size = Math.max(1, Math.floor(pageSize));
  const pages = Math.max(1, Math.ceil(sorted.length / size));
  const current = Math.min(page, pages - 1);
  const visible = hydrated
    ? sorted.slice(current * size, (current + 1) * size)
    : sorted;
  return (
    <>
      <div className="flex flex-wrap items-end gap-3 p-3 print:hidden">
        {searchable ? (
          <label className="grid gap-1 text-xs" htmlFor={`${id}-search`}>
            Search table
            <input
              className={DATA_INPUT}
              id={`${id}-search`}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </label>
        ) : null}
        {filterColumns.map((key) => (
          <label className="grid gap-1 text-xs" key={key}>
            {key}
            <select
              aria-label={key}
              className={DATA_INPUT}
              value={filters[key] ?? ""}
              onChange={(event) => {
                setFilters({ ...filters, [key]: event.target.value });
                setPage(0);
              }}
            >
              <option value="">All</option>
              {[...new Set(rows.map((row) => display(row[key])))]
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
            downloadText(
              csvOf(sorted, columns),
              "data.csv",
              "text/csv;charset=utf-8"
            );
          }}
        >
          Save CSV
        </button>
        <button
          className={DATA_BUTTON}
          type="button"
          onClick={() => {
            downloadText(
              JSON.stringify(sorted, null, 2),
              "data.json",
              "application/json"
            );
          }}
        >
          Save JSON
        </button>
      </div>
      <div className="overflow-x-auto print:hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  className="border-b border-neutral-200 px-4 py-2 dark:border-neutral-700"
                  scope="col"
                  key={column}
                  aria-sort={sortDirection(sort, column)}
                >
                  <button
                    type="button"
                    className="flex items-center gap-1 text-left font-medium"
                    onClick={() => {
                      setSort({
                        column,
                        descending: sort.column === column && !sort.descending,
                      });
                      setPage(0);
                    }}
                  >
                    {column}
                    <span aria-hidden="true">
                      {SORT_ICONS[sortDirection(sort, column)]}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => (
              <tr key={display(row.id) || String(current * size + index)}>
                {columns.map((column) => (
                  <td
                    key={column}
                    className="border-b border-neutral-100 px-4 py-2 align-top whitespace-pre-wrap dark:border-neutral-800"
                  >
                    {display(row[column]) || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="hidden print:block">
        <DataGrid rows={sorted} columns={columns} />
      </div>
      {visible.length ? null : <p className="p-4">No matching rows</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
        <output>
          {sorted.length} rows · Page {current + 1} / {pages}
        </output>
        <div className="flex gap-2 print:hidden">
          <button
            className={DATA_BUTTON}
            type="button"
            disabled={current === 0}
            onClick={() => {
              setPage(current - 1);
            }}
          >
            Previous
          </button>
          <button
            className={DATA_BUTTON}
            type="button"
            disabled={current + 1 >= pages}
            onClick={() => {
              setPage(current + 1);
            }}
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
};

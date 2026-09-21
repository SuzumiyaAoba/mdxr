import type { ReactNode } from "react";

import type { DataRecord } from "../extended/data.js";
import { columnsOf, display, keyed, recordKey } from "../extended/data.js";
import { DATA_PANEL } from "./data-props.js";

export const DataPanel = ({
  title,
  children,
  id,
  summary,
}: {
  title?: string;
  children?: ReactNode;
  id?: string;
  summary?: string;
}) => (
  <section className={DATA_PANEL} id={id} aria-label={title}>
    {title !== undefined && title !== "" ? (
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 font-semibold dark:border-neutral-700 dark:bg-neutral-800">
        {title}
      </div>
    ) : null}
    {summary !== undefined && summary !== "" ? (
      <output className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-300">
        {summary}
      </output>
    ) : null}
    {children}
  </section>
);

export const DataGrid = ({
  rows,
  columns = columnsOf(rows),
  caption,
}: {
  rows: DataRecord[];
  columns?: string[];
  caption?: string;
}) => (
  <div className="overflow-x-auto">
    <table className="w-full border-collapse text-left text-sm">
      {caption !== undefined && caption !== "" ? (
        <caption className="px-4 py-2 text-left">{caption}</caption>
      ) : null}
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              className="border-b border-neutral-200 px-4 py-2 font-medium dark:border-neutral-700"
              scope="col"
              key={column}
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {keyed(rows, recordKey).map(({ key, value: row }) => (
          <tr key={key}>
            {columns.map((column) => (
              <td
                className="border-b border-neutral-100 px-4 py-2 align-top whitespace-pre-wrap dark:border-neutral-800"
                key={column}
              >
                {display(row[column]) || "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    {rows.length === 0 ? <p className="p-4 text-sm">No data</p> : null}
  </div>
);

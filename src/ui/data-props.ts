import * as v from "valibot";

import { BOOLISH_PROP } from "./attrs.js";

export const DATA_PROPS = {
  columns: v.optional(v.string()),
  data: v.optional(v.string()),
  format: v.optional(v.picklist(["json", "csv"]), "json"),
  id: v.optional(v.string()),
  title: v.optional(v.string()),
} as const;

export const DATA_PANEL =
  "not-prose my-5 overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";
export const DATA_BUTTON =
  "rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-sky-500 disabled:opacity-40 dark:border-neutral-600 dark:hover:bg-neutral-800";
export const DATA_INPUT =
  "rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-600";

export const INTERACTIVE_DATA_PROPS = {
  ...DATA_PROPS,
  pageSize: v.optional(v.string(), "10"),
  searchable: BOOLISH_PROP,
};

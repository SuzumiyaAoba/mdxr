import { createContext, useSyncExternalStore } from "react";

import type { DataRecord } from "../extended/data.js";
import { display } from "../extended/data.js";
import { own } from "../guards.js";

export const FilterContext = createContext<Record<string, string>>({});
export const PlotScaleContext = createContext<DataRecord>({});

export const matchesFilters = (
  row: DataRecord,
  filters: Record<string, string>
): boolean =>
  Object.entries(filters).every(
    ([key, value]) => !value || display(own(row, key)) === value
  );

const subscribe = (): (() => void) => () => {
  // No external events: React checks the client snapshot during hydration.
};
const client = (): boolean => true;
const server = (): boolean => false;

/** Keep every row available in static HTML; paginate after hydration. */
export const useHydrated = (): boolean =>
  useSyncExternalStore(subscribe, client, server);

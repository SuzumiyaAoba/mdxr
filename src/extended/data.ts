import { isRecord as isObject, own } from "../guards.js";

export type DataRecord = Record<string, unknown>;

export const isDataRecord = (value: unknown): value is DataRecord =>
  isObject(value) && !Array.isArray(value);

export const display = (value: unknown): string => {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
    ? String(value)
    : "";
};

export const parseJson = (source: string, label = "data"): unknown => {
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(`${label}: expected valid JSON`);
  }
};

const quotedField = (
  input: string,
  start: number
): { value: string; end: number } => {
  let value = "";
  for (let i = start; i < input.length; i += 1) {
    const char = input[i];
    if (char !== '"') {
      value += char;
      continue;
    }
    if (input[i + 1] !== '"') {
      return { end: i, value };
    }
    value += '"';
    i += 1;
  }
  throw new Error("CSV: unterminated quoted field");
};

/** RFC 4180 fields, including quoted newlines and doubled quotes. */
export const parseCsv = (source: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let closed = false;
  const input = source.replace(/^\uFEFF/u, "").replaceAll(/\r\n?/gu, "\n");
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === "," || char === "\n") {
      row.push(field);
      field = "";
      closed = false;
      if (char === "\n") {
        rows.push(row);
        row = [];
      }
      continue;
    }
    if (char === '"' && field === "" && !closed) {
      const quoted = quotedField(input, i + 1);
      field = quoted.value;
      i = quoted.end;
      closed = true;
      continue;
    }
    if (closed || char === '"') {
      throw new Error("CSV: unexpected character after a quoted field");
    }
    field += char;
  }
  if (row.length > 0 || field !== "" || closed) {
    rows.push([...row, field]);
  }
  return rows;
};

export const tableRecords = (table: string[][]): DataRecord[] => {
  const [headers, ...rows] = table;
  if (!(headers !== undefined)) {
    return [];
  }
  if (
    headers.some((key) => key.trim() === "") ||
    new Set(headers).size !== headers.length
  ) {
    throw new Error("Data table: column names must be nonempty and unique");
  }
  return rows.map((cells, index) => {
    if (cells.length !== headers.length) {
      throw new Error(
        `Data table: row ${index + 1} has ${cells.length} cells; expected ${headers.length}`
      );
    }
    return Object.fromEntries(headers.map((key, i) => [key, cells[i] ?? ""]));
  });
};

export const records = (value: unknown, label = "data"): DataRecord[] => {
  if (!Array.isArray(value) || !value.every(isDataRecord)) {
    throw new Error(`${label}: expected a JSON array of objects`);
  }
  return value;
};

export const readRecords = (source: string, format = "json"): DataRecord[] => {
  if (source.trim() === "") {
    return [];
  }
  return format === "csv"
    ? tableRecords(parseCsv(source))
    : records(parseJson(source));
};

export const numberValue = (
  value: unknown,
  label = "value",
  fallback?: number
): number => {
  if (value === undefined || value === null || value === "") {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`${label}: expected a finite number`);
  }
  if (typeof value === "string" && value.trim() === "") {
    throw new Error(`${label}: expected a finite number`);
  }
  const n = typeof value === "number" ? value : Number(value);
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    !Number.isFinite(n)
  ) {
    throw new Error(`${label}: expected a finite number`);
  }
  return n;
};

export const positive = (
  value: unknown,
  label: string,
  fallback?: number
): number => {
  const n = numberValue(value, label, fallback);
  if (n < 0) {
    throw new Error(`${label}: must be nonnegative`);
  }
  return n;
};

export const numbers = (value: unknown, label = "values"): number[] => {
  const input: unknown =
    typeof value === "string" ? parseJson(value, label) : value;
  if (!Array.isArray(input)) {
    throw new TypeError(`${label}: expected an array of numbers`);
  }
  return input.map((n) => numberValue(n, label));
};

export const columnsOf = (rows: DataRecord[], columns?: string): string[] =>
  columns !== undefined && columns !== ""
    ? columns
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean)
    : [...new Set(rows.flatMap(Object.keys))];

export const csvOf = (rows: DataRecord[], columns = columnsOf(rows)): string =>
  [columns, ...rows.map((row) => columns.map((key) => display(own(row, key))))]
    .map((row) =>
      row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")
    )
    .join("\r\n");

export const mean = (values: number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((sum, n) => sum + n, 0) / values.length;

/** Linear interpolation over sorted observations (R-7 quantiles). */
export const quantile = (values: number[], probability: number): number => {
  if (values.length === 0) {
    throw new Error("Quantile needs at least one observation");
  }
  const sorted = values.toSorted((a, b) => a - b);
  const position = Math.max(0, Math.min(1, probability)) * (sorted.length - 1);
  const low = Math.floor(position);
  const a = sorted[low] ?? 0;
  return (
    a +
    ((sorted[Math.min(low + 1, sorted.length - 1)] ?? a) - a) * (position - low)
  );
};

export const deviation = (values: number[]): number => {
  if (values.length < 2) {
    return 0;
  }
  const avg = mean(values);
  return Math.sqrt(
    values.reduce((sum, n) => sum + (n - avg) ** 2, 0) / (values.length - 1)
  );
};

export const rounded = (value: number): number =>
  value !== 0 && Math.abs(value) < 0.001
    ? Number(value.toPrecision(3))
    : Number(value.toFixed(3));

export const percentage = (part: number, total: number): string =>
  total === 0 ? "—" : `${rounded((part / total) * 100)}%`;

export const uniqueIds = (
  rows: DataRecord[],
  key = "id"
): Map<string, DataRecord> => {
  const map = new Map<string, DataRecord>();
  for (const row of rows) {
    const id = display(own(row, key));
    if (!id || map.has(id)) {
      throw new Error(`Expected a unique, nonempty ${key}: ${id}`);
    }
    map.set(id, row);
  }
  return map;
};

export const words = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map(display)
    : display(value)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

export const dateValue = (value: unknown, label = "date"): number => {
  const source = display(value);
  const time = Date.parse(source);
  if (
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/u.test(
      source
    ) ||
    !Number.isFinite(time) ||
    new Date(Date.parse(source.slice(0, 10))).toISOString().slice(0, 10) !==
      source.slice(0, 10)
  ) {
    throw new Error(`${label}: expected an ISO date or timestamp`);
  }
  return time;
};

/** Stable content keys, with occurrence suffixes for indistinguishable duplicates. */
export const keyed = <T>(
  values: T[],
  identity: (value: T) => string = display
): { key: string; value: T }[] => {
  const occurrences = new Map<string, number>();
  return values.map((value) => {
    const base = identity(value);
    const count = occurrences.get(base) ?? 0;
    occurrences.set(base, count + 1);
    return { key: `${base}#${count}`, value };
  });
};

export const recordKey = (row: DataRecord): string =>
  display(row.id) || display(row);

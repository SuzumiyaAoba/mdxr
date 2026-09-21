import {
  isDataRecord as isRecord,
  display,
  records,
  uniqueIds,
} from "./data.js";
import type { DataRecord } from "./data.js";

const pointer = (key: string): string =>
  key.replaceAll("~", "~0").replaceAll("/", "~1");

export const equalData = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) {
    return true;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length && a.every((value, i) => equalData(value, b[i]))
    );
  }
  if (isRecord(a) && isRecord(b)) {
    return (
      Object.keys(a).length === Object.keys(b).length &&
      Object.entries(a).every(
        ([key, value]) => Object.hasOwn(b, key) && equalData(value, b[key])
      )
    );
  }
  return false;
};

/** JSON Pointer locations, preserving missing versus explicit null. */
export const jsonDifference = (
  before: unknown,
  after: unknown,
  path = ""
): DataRecord[] => {
  if (equalData(before, after)) {
    return [];
  }
  if (isRecord(before) && isRecord(after)) {
    return [
      ...new Set([...Object.keys(before), ...Object.keys(after)]),
    ].flatMap((key) => {
      const location = `${path}/${pointer(key)}`;
      if (!Object.hasOwn(before, key)) {
        return [{ after: after[key], change: "added", path: location }];
      }
      if (!Object.hasOwn(after, key)) {
        return [{ before: before[key], change: "removed", path: location }];
      }
      return jsonDifference(before[key], after[key], location);
    });
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const oldItems: unknown[] = before;
    const newItems: unknown[] = after;
    return Array.from(
      { length: Math.max(before.length, after.length) },
      (_, i) => {
        const location = `${path}/${i}`;
        if (i >= before.length) {
          return [{ after: newItems[i], change: "added", path: location }];
        }
        if (i >= after.length) {
          return [{ before: oldItems[i], change: "removed", path: location }];
        }
        return jsonDifference(before[i], after[i], location);
      }
    ).flat();
  }
  return [{ after, before, change: "changed", path: path || "/" }];
};

const datasetDifference = (
  before: unknown,
  after: unknown,
  key: string
): DataRecord[] => {
  const oldRows = uniqueIds(records(before, "before"), key);
  const newRows = uniqueIds(records(after, "after"), key);
  return [...new Set([...oldRows.keys(), ...newRows.keys()])].flatMap((id) => {
    const oldRow = oldRows.get(id);
    const newRow = newRows.get(id);
    if (!oldRow) {
      return [{ after: newRow, change: "added", id }];
    }
    if (!newRow) {
      return [{ before: oldRow, change: "removed", id }];
    }
    return jsonDifference(oldRow, newRow).map((change) => ({ id, ...change }));
  });
};

const classifyContract = (row: DataRecord): DataRecord => {
  const path = display(row.path);
  const removal = row.change === "removed";
  const restriction =
    (path.endsWith("/required") && row.after === true) ||
    (path.endsWith("/nullable") && row.after === false);
  const typeChange = path.endsWith("/type") && row.change === "changed";
  let reason = "Review consumer and provider usage";
  if (removal) {
    reason = "Removed contract element";
  } else if (restriction) {
    reason = "Stricter input constraint";
  } else if (typeChange) {
    reason = "Type changed";
  }
  return {
    ...row,
    compatibility: removal || restriction || typeChange ? "breaking" : "review",
    reason,
  };
};

export const differenceModel = (
  kind: string,
  before: unknown,
  after: unknown,
  key = "id"
): DataRecord[] => {
  if (kind === "DatasetDiff") {
    return datasetDifference(before, after, key);
  }
  const rows =
    Array.isArray(before) &&
    Array.isArray(after) &&
    (kind === "ApiDiff" || kind === "SchemaDiff")
      ? datasetDifference(before, after, key)
      : jsonDifference(before, after);
  return kind === "ApiDiff" || kind === "SchemaDiff"
    ? rows.map(classifyContract)
    : rows;
};

/** Expand layered configuration in declared order; later layers win. */
export const resolveConfig = (
  value: unknown
): { values: DataRecord; sources: DataRecord } => {
  if (!Array.isArray(value)) {
    if (!isRecord(value)) {
      throw new Error(
        "ConfigDiff: expected an object or [{name,values}] layers"
      );
    }
    return { sources: {}, values: value };
  }
  const values: DataRecord = {};
  const sources: DataRecord = {};
  for (const layer of records(value)) {
    if (!isRecord(layer.values)) {
      throw new Error("ConfigDiff: each layer needs values");
    }
    for (const [key, item] of Object.entries(layer.values)) {
      Object.defineProperty(values, key, {
        configurable: true,
        enumerable: true,
        value: item,
        writable: true,
      });
      Object.defineProperty(sources, key, {
        configurable: true,
        enumerable: true,
        value: layer.name,
        writable: true,
      });
    }
  }
  return { sources, values };
};

interface SchemaChild {
  value: unknown;
  path: string;
  required: string[];
}

const schemaChildren = (schema: DataRecord, prefix: string): SchemaChild[] => {
  const required = Array.isArray(schema.required)
    ? schema.required.map(display)
    : [];
  const fields = isRecord(schema.properties)
    ? Object.entries(schema.properties)
    : [];
  const children = fields.map(([key, value]) => ({
    path: prefix ? `${prefix}.${key}` : key,
    required,
    value,
  }));
  if (schema.items !== undefined) {
    children.push({ path: `${prefix}[]`, required: [], value: schema.items });
  }
  for (const union of ["oneOf", "anyOf", "allOf"]) {
    if (!Array.isArray(schema[union])) {
      continue;
    }
    const values: unknown[] = schema[union];
    children.push(
      ...values.map((value, index) => ({
        path: `${prefix}.${union}[${index}]`,
        required: [],
        value,
      }))
    );
  }
  return children;
};

export const schemaRows = (
  schema: unknown,
  prefix = "",
  required: string[] = [],
  depth = 0
): DataRecord[] => {
  if (depth > 40) {
    throw new Error("ObjectSchema: nesting exceeds 40 levels");
  }
  if (!isRecord(schema)) {
    throw new Error("ObjectSchema: expected a JSON Schema object");
  }
  const rows: DataRecord[] = [];
  if (prefix) {
    rows.push({
      default: schema.default,
      description: schema.description,
      enum: schema.enum,
      maximum: schema.maximum,
      minimum: schema.minimum,
      path: prefix,
      ref: schema.$ref,
      required: required.includes(prefix.split(".").at(-1) ?? ""),
      type: schema.type ?? (isRecord(schema.properties) ? "object" : ""),
    });
  }
  return [
    ...rows,
    ...schemaChildren(schema, prefix).flatMap((child) =>
      schemaRows(child.value, child.path, child.required, depth + 1)
    ),
  ];
};

/** The same provenance-aware comparison is used by HTML and Markdown. */
export const comparisonModel = (
  kind: string,
  before: unknown,
  after: unknown,
  key = "id"
): DataRecord[] => {
  if (kind !== "ConfigDiff") {
    return differenceModel(kind, before, after, key);
  }
  const oldConfig = resolveConfig(before);
  const newConfig = resolveConfig(after);
  return differenceModel(kind, oldConfig.values, newConfig.values, key).map(
    (row) => {
      const field =
        display(row.path)
          .split("/")[1]
          ?.replaceAll("~1", "/")
          .replaceAll("~0", "~") ?? "";
      return {
        ...row,
        afterSource: newConfig.sources[field],
        beforeSource: oldConfig.sources[field],
      };
    }
  );
};

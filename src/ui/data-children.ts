import { isValidElement } from "react";
import type { ReactNode } from "react";

import { flattenChildren, textOf } from "../define.js";
import type { DataRecord } from "../extended/data.js";
import { readRecords, tableRecords } from "../extended/data.js";
import { RecordItem } from "./record-item.js";

const descendants = (
  children: ReactNode,
  predicate: (node: ReactNode) => boolean
): ReactNode[] => {
  const found: ReactNode[] = [];
  for (const child of flattenChildren(children)) {
    if (predicate(child)) {
      found.push(child);
    } else if (isValidElement<{ children?: ReactNode }>(child)) {
      found.push(...descendants(child.props.children, predicate));
    }
  }
  return found;
};

export const tagged = (children: ReactNode, tag: string): ReactNode[] =>
  descendants(children, (node) => isValidElement(node) && node.type === tag);

export const dataChildren = (
  children: ReactNode
): { format: string; source: string } | undefined => {
  const [code] = descendants(
    children,
    (node) =>
      isValidElement<{ className?: string }>(node) &&
      node.type === "code" &&
      /language-(?:json|csv)\b/u.test(node.props.className ?? "")
  );
  if (!isValidElement<{ className?: string; children?: ReactNode }>(code)) {
    return undefined;
  }
  return {
    format:
      (code.props.className?.includes("language-csv") ?? false)
        ? "csv"
        : "json",
    source: textOf(code.props.children),
  };
};

export const rowsFrom = (props: {
  data?: string;
  format?: string;
  children?: ReactNode;
}): DataRecord[] => {
  if (props.data !== undefined) {
    return readRecords(props.data, props.format);
  }
  const code = dataChildren(props.children);
  if (code) {
    return readRecords(code.source, code.format);
  }
  const rows = tagged(props.children, "tr").map((row) => {
    if (!isValidElement<{ children?: ReactNode }>(row)) {
      return [];
    }
    return flattenChildren(row.props.children)
      .filter(
        (cell) =>
          isValidElement(cell) && (cell.type === "td" || cell.type === "th")
      )
      .map(textOf);
  });
  if (rows.length > 0) {
    return tableRecords(rows);
  }
  return descendants(
    props.children,
    (node) => isValidElement(node) && node.type === RecordItem
  ).map((node) =>
    isValidElement<DataRecord>(node)
      ? Object.fromEntries(
          Object.entries(node.props).filter(([key]) => key !== "children")
        )
      : {}
  );
};

/** Retain prose surrounding a structured-data block without duplicating that block. */
export const dataNarrative = (children: ReactNode): ReactNode[] =>
  flattenChildren(children).filter((child) => {
    if (!isValidElement(child)) {
      return true;
    }
    return (
      child.type !== RecordItem &&
      child.type !== "table" &&
      dataChildren(child) === undefined
    );
  });

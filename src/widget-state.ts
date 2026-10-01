import { isRecord } from "./guards.js";

export interface WidgetRecord {
  key: string;
  kind: "question" | "board";
  signature: string;
  values: { value: string; checked: boolean }[];
  lanes: { id: string; cards: string[] }[];
}
export interface WidgetState {
  version: 1;
  records: WidgetRecord[];
}

const isWidgetValue = (
  value: unknown
): value is WidgetRecord["values"][number] =>
  isRecord(value) &&
  typeof value.value === "string" &&
  typeof value.checked === "boolean";
const isWidgetLane = (value: unknown): value is WidgetRecord["lanes"][number] =>
  isRecord(value) &&
  typeof value.id === "string" &&
  Array.isArray(value.cards) &&
  value.cards.every((card: unknown) => typeof card === "string");
const isWidgetRecord = (value: unknown): value is WidgetRecord =>
  isRecord(value) &&
  typeof value.key === "string" &&
  (value.kind === "question" || value.kind === "board") &&
  typeof value.signature === "string" &&
  Array.isArray(value.values) &&
  value.values.every(isWidgetValue) &&
  Array.isArray(value.lanes) &&
  value.lanes.every(isWidgetLane);

export const parseWidgetState = (raw: string | null): WidgetState => {
  if (raw === null) {
    return { records: [], version: 1 };
  }
  const value: unknown = JSON.parse(raw);
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.records) ||
    !value.records.every(isWidgetRecord)
  ) {
    throw new Error("Invalid saved widget state");
  }
  const { records } = value;
  if (new Set(records.map(({ key }) => key)).size !== records.length) {
    throw new Error("Duplicate saved widget identifiers");
  }
  return { records, version: 1 };
};

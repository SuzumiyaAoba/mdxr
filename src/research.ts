import * as v from "valibot";

import { NUMISH } from "./ui/attrs.js";

const NON_EMPTY = v.pipe(v.string(), v.trim(), v.nonEmpty());
const REFERENCE_ID = v.pipe(
  v.string(),
  v.regex(/^\S+$/u, "Expected an id without whitespace")
);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu;

const isDate = (value: string): boolean => {
  const date = new Date(value);
  return (
    DATE_PATTERN.test(value) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

const DATE = v.pipe(
  NON_EMPTY,
  v.check(isDate, "Expected a valid YYYY-MM-DD date")
);

/** Units are a separate prop: reject partial numbers, blanks and infinities. */
export const FINITE_NUMBER = v.pipe(
  NUMISH,
  v.check(
    (value) =>
      (typeof value === "number" || DECIMAL_PATTERN.test(value.trim())) &&
      Number.isFinite(Number(value)),
    "Expected a finite decimal number; put its unit in unit"
  ),
  v.transform(Number)
);

export const CLAIM_KINDS = [
  "documented",
  "inference",
  "proposal",
  "unknown",
] as const;
export const CLAIM_LABELS = {
  documented: "Documented",
  inference: "Inference",
  proposal: "Proposal",
  unknown: "Unconfirmed",
} as const;

export const RESEARCH_CLAIM_SCHEMA = v.pipe(
  v.looseObject({
    checked: v.optional(DATE),
    citationId: v.optional(v.string()),
    id: v.optional(REFERENCE_ID),
    kind: v.picklist(CLAIM_KINDS),
    source: v.optional(REFERENCE_ID),
    sourceHref: v.optional(v.string()),
    sourceLabel: v.optional(v.string()),
    title: v.optional(NON_EMPTY),
  }),
  v.check(
    (props) =>
      !["documented", "inference"].includes(props.kind) ||
      props.source !== undefined,
    "Documented claims and inferences require a source id"
  ),
  v.check(
    (props) => props.kind !== "documented" || props.checked !== undefined,
    "Documented claims require a checked date"
  )
);

export const PERFORMANCE_TARGET_SCHEMA = v.pipe(
  v.looseObject({
    actual: v.optional(FINITE_NUMBER),
    better: v.optional(v.picklist(["lower", "higher"]), "lower"),
    conditions: NON_EMPTY,
    measuredAt: v.optional(DATE),
    name: NON_EMPTY,
    statistic: v.optional(NON_EMPTY),
    status: v.optional(v.picklist(["unmeasured", "measured"]), "unmeasured"),
    target: FINITE_NUMBER,
    unit: NON_EMPTY,
  }),
  v.check(
    (props) => props.status !== "measured" || props.actual !== undefined,
    "Measured targets require an actual value"
  ),
  v.check(
    (props) =>
      props.status !== "unmeasured" ||
      (props.actual === undefined && props.measuredAt === undefined),
    "Unmeasured targets cannot have actual or measuredAt"
  )
);

export type PerformanceTargetProps = v.InferOutput<
  typeof PERFORMANCE_TARGET_SCHEMA
>;
export type PerformanceResult = "unmeasured" | "met" | "missed";

export const PERFORMANCE_LABELS: Record<PerformanceResult, string> = {
  met: "Meets target",
  missed: "Misses target",
  unmeasured: "Not measured",
};

export const performanceResult = (
  props: PerformanceTargetProps
): PerformanceResult => {
  if (props.status === "unmeasured" || props.actual === undefined) {
    return "unmeasured";
  }
  const met =
    props.better === "lower"
      ? props.actual <= props.target
      : props.actual >= props.target;
  return met ? "met" : "missed";
};

/** Shared by HTML and text so missing observations never become zero. */
export const performanceDetails = (
  props: PerformanceTargetProps
): [string, string][] => {
  const rows: [string, string][] = [
    [
      "Target",
      `${props.better === "lower" ? "≤" : "≥"} ${props.target} ${props.unit}`,
    ],
    [
      "Actual",
      props.actual === undefined
        ? "Not measured"
        : `${props.actual} ${props.unit}`,
    ],
  ];
  if (props.statistic !== undefined) {
    rows.push(["Statistic", props.statistic]);
  }
  rows.push(["Conditions", props.conditions]);
  if (props.measuredAt !== undefined) {
    rows.push(["Measured", props.measuredAt]);
  }
  return rows;
};

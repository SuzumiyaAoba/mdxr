import * as v from "valibot";

import { NUMISH } from "./attrs.js";

/** Bounded whole counts also accept MDX string attributes. */
export const wireframeCount = (max: number) =>
  v.pipe(
    NUMISH,
    v.transform(Number),
    v.integer(),
    v.minValue(1),
    v.maxValue(max)
  );

export const WIREFRAME_WIDTH = v.picklist([
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "full",
]);

export const WIREFRAME_TEXT_PROPS = {
  color: v.optional(
    v.picklist([
      "default",
      "muted",
      "subtle",
      "primary",
      "secondary",
      "accent",
    ]),
    "default"
  ),
  emphasis: v.optional(
    v.picklist(["primary", "secondary", "tertiary", "subtle"])
  ),
  size: v.optional(v.picklist(["xs", "sm", "base", "lg", "xl"]), "base"),
} as const;

export const WIREFRAME_SPACING = v.optional(
  v.picklist(["tight", "normal", "relaxed"]),
  "normal"
);

export const WIREFRAME_GAPS = {
  normal: "gap-2",
  relaxed: "gap-3",
  tight: "gap-1",
} as const;

export const WIREFRAME_COMMON = {
  className: v.optional(v.string()),
  id: v.optional(v.string()),
} as const;

/** Positions identify immutable placeholder slots, never user data. */
export const wireframeSlots = (count: number): number[] =>
  Array.from({ length: count }, (_, index) => index + 1);

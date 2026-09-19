import * as v from "valibot";

import { defineComponent } from "../define.js";
import { Icon } from "./icon.js";
import { TONE } from "./tones.js";

export const EFFORT_SIZES = ["xs", "s", "m", "l", "xl"] as const;
export type EffortSize = (typeof EFFORT_SIZES)[number];

export const Effort = defineComponent(
  {
    description:
      '工数ピル。size は xs|s|m|l|xl。children に "3d" のような見積もりを書ける',
    schema: v.looseObject({
      size: v.optional(v.picklist(EFFORT_SIZES), "m"),
    }),
  },
  ({ size, children }) => (
    <span
      className={`not-prose inline-flex items-baseline gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-medium ${TONE.neutral}`}
    >
      <Icon className="h-3 w-3 self-center" name="lucide:hourglass" />
      {size.toUpperCase()}
      {children === undefined || children === "" ? null : (
        <span className="font-sans font-normal opacity-75">{children}</span>
      )}
    </span>
  )
);

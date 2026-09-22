import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { numList } from "./chart.js";
import { TONE_TEXT } from "./tones.js";

export const SPARK_TONES = [
  "neutral",
  "emerald",
  "amber",
  "red",
  "sky",
  "violet",
] as const;
export type SparkTone = (typeof SPARK_TONES)[number];

const PAD = 1.5;
const W = 100;
const H = 24;

export const Spark = defineComponent(
  {
    description:
      'インラインスパークライン (小さな折れ線 SVG)。values に数値列 ("3,8,2,12,5")、tone で色、label で aria ラベル。本文中のトレンド表示向け',
    schema: v.looseObject({
      label: v.optional(v.string()),
      tone: v.optional(v.picklist(SPARK_TONES), "neutral"),
      values: v.string(),
    }),
  },
  ({ values, tone, label }) => {
    const pts = numList(values);
    if (pts.length < 2) {
      return null;
    }
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const span = max - min || 1;
    const stepX = (W - PAD * 2) / (pts.length - 1);
    const points = pts
      .map(
        (p, i) =>
          `${(PAD + i * stepX).toFixed(2)},${(
            PAD +
            (1 - (p - min) / span) * (H - PAD * 2)
          ).toFixed(2)}`
      )
      .join(" ");
    return (
      <span
        className={`not-prose mx-0.5 inline-flex align-middle ${TONE_TEXT[tone]}`}
      >
        <svg
          aria-hidden={!nonEmpty(label)}
          aria-label={nonEmpty(label) ? label : undefined}
          className="h-4 w-16"
          preserveAspectRatio="none"
          role={nonEmpty(label) ? "img" : undefined}
          viewBox={`0 0 ${W} ${H}`}
        >
          <polyline
            fill="none"
            points={points}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </span>
    );
  }
);

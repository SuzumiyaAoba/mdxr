import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { NUMISH, numOf } from "./attrs.js";
import { CODE_CHIP_CLS } from "./bits.js";
import { ChartPanel } from "./chart-bits.js";
import { CHART_TONES, textList, toneOf } from "./chart.js";
import { collectChildProps } from "./children.js";
import { BORDER_CLS, RAIL_BG_CLS, TEXT, TEXT_MICRO } from "./tones.js";

/**
 * Quadrant map — <Pin> items positioned on two 0–100 axes (`x`/`y` name
 * them). Midlines split the square into four regions; `quadrants` labels
 * them top-left → top-right → bottom-left → bottom-right.
 */

const PIN_SCHEMA = v.looseObject({
  name: v.string(),
  note: v.optional(v.string()),
  tone: v.optional(v.picklist(CHART_TONES)),
  x: NUMISH,
  y: NUMISH,
});

type PinSpec = v.InferOutput<typeof PIN_SCHEMA>;

export const Pin = defineComponent(
  {
    description:
      "クアドラントの1項目。<Quadrant> の子。name/x/y は必須 (x/y は 0–100)、note で補足、tone で色",
    schema: PIN_SCHEMA,
  },
  // Standalone use: a `name (x, y)` chip so misplaced pins still render.
  ({ name, x, y }): ReactElement => (
    <span className={`font-mono ${CODE_CHIP_CLS}`}>
      {name}
      <span className="opacity-70">
        ({x}, {y})
      </span>
    </span>
  )
);

const collectPins = (
  children: ReactNode
): { pins: { spec: PinSpec; x: number; y: number }[]; rest: ReactNode[] } => {
  const { items, rest } = collectChildProps(children, Pin, PIN_SCHEMA, "Pin");
  const pins = items.flatMap((spec) => {
    const x = numOf(spec.x);
    const y = numOf(spec.y);
    return x === undefined || y === undefined ? [] : [{ spec, x, y }];
  });
  return { pins, rest };
};

const CORNER_CLS = `absolute font-mono ${TEXT_MICRO} uppercase tracking-wider ${TEXT.faint}`;

export const Quadrant = defineComponent(
  {
    description:
      'クアドラントマップコンテナ (2軸ポジショニング)。<Pin name x y> を 0–100 空間に置く。x/y で軸名、quadrants="TL,TR,BL,BR" で各象限ラベル',
    schema: v.looseObject({
      quadrants: v.optional(v.string()),
      title: v.optional(v.string()),
      x: v.optional(v.string()),
      y: v.optional(v.string()),
    }),
  },
  ({ title, x, y, quadrants, children }) => {
    const { pins, rest } = collectPins(children);
    const corners = textList(quadrants);
    return (
      <ChartPanel icon="lucide:grid-2x2" title={title}>
        <div className="px-4 py-4">
          <div
            className={`relative mx-auto aspect-square w-full max-w-md rounded-lg border ${BORDER_CLS}`}
          >
            {/* midlines */}
            <div
              aria-hidden
              className={`absolute inset-y-0 left-1/2 w-px ${RAIL_BG_CLS}`}
            />
            <div
              aria-hidden
              className={`absolute inset-x-0 top-1/2 h-px ${RAIL_BG_CLS}`}
            />
            {/* quadrant labels */}
            {corners[0] === undefined ? null : (
              <span className={`${CORNER_CLS} top-2 left-2.5`}>
                {corners[0]}
              </span>
            )}
            {corners[1] === undefined ? null : (
              <span className={`${CORNER_CLS} top-2 right-2.5`}>
                {corners[1]}
              </span>
            )}
            {corners[2] === undefined ? null : (
              <span className={`${CORNER_CLS} bottom-2 left-2.5`}>
                {corners[2]}
              </span>
            )}
            {corners[3] === undefined ? null : (
              <span className={`${CORNER_CLS} right-2.5 bottom-2`}>
                {corners[3]}
              </span>
            )}
            {pins.map((p, i) => {
              const style = toneOf(p.spec.tone, i);
              return (
                <div
                  className="absolute -translate-x-1/2 translate-y-1/2"
                  key={p.spec.name}
                  style={{
                    bottom: `${Math.min(100, Math.max(0, p.y))}%`,
                    left: `${Math.min(100, Math.max(0, p.x))}%`,
                  }}
                  title={`${p.spec.name} · ${p.x}, ${p.y}`}
                >
                  <div className="flex flex-col items-center">
                    <span
                      className={`mb-0.5 rounded px-1 text-[0.65rem] font-medium whitespace-nowrap ${TEXT.chip} bg-white/80 dark:bg-neutral-900/80`}
                    >
                      {p.spec.name}
                    </span>
                    <span
                      className={`h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-neutral-950 ${style.bg}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {/* axis titles */}
          <div className="mx-auto mt-1.5 flex max-w-md items-center justify-between">
            {nonEmpty(y) ? (
              <span
                className={`font-mono ${TEXT_MICRO} uppercase ${TEXT.faint}`}
              >
                ↑ {y}
              </span>
            ) : (
              <span />
            )}
            {nonEmpty(x) ? (
              <span
                className={`font-mono ${TEXT_MICRO} uppercase ${TEXT.faint}`}
              >
                {x} →
              </span>
            ) : (
              <span />
            )}
          </div>
          {rest.length > 0 ? (
            <div className={`${TEXT_MICRO} ${TEXT.muted}`}>{rest}</div>
          ) : null}
        </div>
      </ChartPanel>
    );
  }
);

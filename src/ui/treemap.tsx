import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, flattenChildren, parseProps } from "../define.js";
import { nonEmpty } from "../guards.js";
import { NUMISH, numOf } from "./attrs.js";
import { CODE_CHIP_CLS } from "./bits.js";
import { ChartPanel } from "./chart-bits.js";
import { CHART_TONES, fmtNum, squarify, toneOf } from "./chart.js";
import { isEl } from "./children.js";
import { TEXT_MICRO } from "./tones.js";

/**
 * Treemap — part-of-whole areas packed by the squarified algorithm.
 * <Tile> size ∝ `value`; labels carry name and share percent.
 */

const TILE_SCHEMA = v.looseObject({
  name: v.string(),
  note: v.optional(v.string()),
  tone: v.optional(v.picklist(CHART_TONES)),
  value: NUMISH,
});

type TileSpec = v.InferOutput<typeof TILE_SCHEMA>;

export const Tile = defineComponent(
  {
    description:
      "ツリーマップの1領域。<Treemap> の子。name/value は必須、note で補足、tone で色指定",
    schema: TILE_SCHEMA,
  },
  // Standalone use: a `name value` chip so misplaced tiles still render.
  ({ name, value, note }): ReactElement => (
    <span className={`font-mono ${CODE_CHIP_CLS}`}>
      {name}
      <span className="opacity-70">{value}</span>
      {nonEmpty(note) ? <span className="opacity-70">{note}</span> : null}
    </span>
  )
);

const collectTiles = (
  children: ReactNode
): { rest: ReactNode[]; tiles: { n: number; spec: TileSpec }[] } => {
  const tiles: { n: number; spec: TileSpec }[] = [];
  const rest: ReactNode[] = [];
  for (const child of flattenChildren(children)) {
    if (isEl(child, Tile)) {
      const spec = parseProps(TILE_SCHEMA, child.props, "Tile");
      tiles.push({ n: Math.max(0, numOf(spec.value) ?? 0), spec });
    } else {
      rest.push(child);
    }
  }
  return { rest, tiles };
};

/** Squarify space — a 16:9 canvas in percentage units. */
const CANVAS = { h: 56.25, w: 100, x: 0, y: 0 };

export const Treemap = defineComponent(
  {
    description:
      "ツリーマップコンテナ (階層的な構成比)。<Tile name value> を並べる。面積は value に比例、squarified レイアウト。unit は値の単位",
    schema: v.looseObject({
      title: v.optional(v.string()),
      unit: v.optional(v.string()),
    }),
  },
  ({ title, unit, children }) => {
    const { tiles, rest } = collectTiles(children);
    const total = tiles.reduce((a, t) => a + t.n, 0);
    const rects = squarify(
      tiles.map((t) => t.n),
      CANVAS
    );
    return (
      <ChartPanel
        figure={nonEmpty(unit) ? `${fmtNum(total)}${unit}` : undefined}
        icon="lucide:layout-grid"
        title={title}
      >
        <div className="px-4 py-3">
          <div className="relative aspect-video w-full">
            {tiles.map((t, i) => {
              const r = rects[i];
              if (r === undefined || r.w <= 0 || r.h <= 0) {
                return null;
              }
              const share = total === 0 ? 0 : (t.n / total) * 100;
              const small = r.w < 16 || r.h < 12;
              return (
                <div
                  className={`absolute overflow-hidden rounded border border-white dark:border-neutral-950 ${toneOf(t.spec.tone, i).tile}`}
                  key={t.spec.name}
                  style={{
                    height: `${r.h}%`,
                    left: `${r.x}%`,
                    top: `${r.y}%`,
                    width: `${r.w}%`,
                  }}
                  title={`${t.spec.name} · ${fmtNum(t.n)}${unit ?? ""} (${Math.round(share)}%)`}
                >
                  <div className="flex h-full flex-col p-1.5">
                    <span className="truncate text-xs font-medium">
                      {t.spec.name}
                    </span>
                    {small ? null : (
                      <span
                        className={`font-mono ${TEXT_MICRO} tabular-nums opacity-80`}
                      >
                        {fmtNum(t.n)}
                        {unit}
                        {` · ${Math.round(share)}%`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {rest.length > 0 ? <div className="px-4 pb-3">{rest}</div> : null}
      </ChartPanel>
    );
  }
);

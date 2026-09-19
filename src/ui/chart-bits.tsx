import type { ReactElement, ReactNode } from "react";

import { CaptionBar, Panel } from "./bits.js";
import type { SeriesStyle } from "./chart.js";
import { Icon } from "./icon.js";
import { CAPTION_TITLE_CLS, MONO_NUM_CLS, TEXT, TEXT_MICRO } from "./tones.js";

/**
 * Shared chart furniture — the `Panel` + `CaptionBar` frame every chart
 * panel uses, and the legend row mapping series names to palette swatches.
 * Layout math lives in `chart.ts`; this file holds the JSX half.
 */

/** Titled chart frame — icon + title + an optional right-side figure. */
export const ChartPanel = (props: {
  children?: ReactNode;
  /** Right-aligned caption figure (range total, max, …). */
  figure?: ReactNode;
  icon: string;
  title?: string;
}): ReactElement => (
  <Panel>
    {props.title === undefined || props.title === "" ? null : (
      <CaptionBar className={CAPTION_TITLE_CLS}>
        <Icon className="h-3.5 w-3.5" name={props.icon} />
        <span className="min-w-0 flex-1 truncate">{props.title}</span>
        {props.figure === undefined ? null : (
          <span className={MONO_NUM_CLS}>{props.figure}</span>
        )}
      </CaptionBar>
    )}
    {props.children}
  </Panel>
);

/** Legend row — colored square + series/item name, wrapping centered. */
export const ChartLegend = (props: {
  items: { name: string; style: SeriesStyle }[];
}): ReactElement | null =>
  props.items.length === 0 ? null : (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 pb-3">
      {props.items.map((item) => (
        <span
          className={`inline-flex items-center gap-1.5 ${TEXT_MICRO} ${TEXT.muted}`}
          key={item.name}
        >
          <span className={`h-2 w-2 rounded-[2px] ${item.style.bg}`} />
          {item.name}
        </span>
      ))}
    </div>
  );

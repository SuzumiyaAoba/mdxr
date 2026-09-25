import type { ReactElement, ReactNode } from "react";

import { TEXT, SUNKEN_CLS } from "./tones.js";

/** Native SVG sizing and a checkbox keep fitting/zoom available without JS. */
export const GraphViewport = ({
  children,
  width,
  height,
  fit,
  minScale,
  title,
}: {
  children: ReactNode;
  width: number;
  height: number;
  fit: "auto" | "scroll";
  minScale: number;
  title?: string;
}): ReactElement => (
  <div className="mdxr-graph-view" data-fit={fit}>
    {fit === "auto" ? (
      <label
        className={`mdxr-graph-tools flex cursor-pointer items-center justify-end gap-2 px-3 py-2 text-xs ${TEXT.muted}`}
      >
        <input className="mdxr-graph-actual" type="checkbox" />
        Actual size
      </label>
    ) : null}
    <div className={`mdxr-graph-scroll overflow-x-auto p-3 ${SUNKEN_CLS}`}>
      <svg
        aria-label={title ?? "Graph"}
        className="mdxr-graph-image"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          height: "auto",
          maxWidth: fit === "auto" ? "100%" : "none",
          minWidth: width * (fit === "auto" ? minScale : 1),
        }}
      >
        <title>{title ?? "Graph"}</title>
        <foreignObject width={width} height={height}>
          <div className="relative" style={{ height, width }}>
            {children}
          </div>
        </foreignObject>
      </svg>
    </div>
  </div>
);

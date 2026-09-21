import { useId } from "react";

import { keyed } from "../extended/data.js";
import type { PlotMark, PlotModel } from "../extended/plots.js";
import { DataGrid, DataPanel } from "./data-view.js";
import { useFileLink } from "./file-link.js";

const SvgShape = ({ mark }: { mark: PlotMark }) => {
  const title =
    mark.label !== undefined && mark.label !== "" ? (
      <title>{mark.label}</title>
    ) : null;
  switch (mark.kind) {
    case "rect": {
      return (
        <rect
          x={mark.x}
          y={mark.y}
          width={mark.width}
          height={mark.height}
          fill={mark.fill}
          opacity={mark.opacity}
        >
          {title}
        </rect>
      );
    }
    case "circle": {
      return (
        <circle cx={mark.x} cy={mark.y} r={mark.r} fill={mark.fill}>
          {title}
        </circle>
      );
    }
    case "line": {
      return (
        <line
          x1={mark.x}
          y1={mark.y}
          x2={mark.x2}
          y2={mark.y2}
          stroke={mark.stroke}
          strokeWidth={mark.strokeWidth ?? 1}
        >
          {title}
        </line>
      );
    }
    case "path": {
      return (
        <path
          d={mark.d}
          fill={mark.fill ?? "none"}
          stroke={mark.stroke}
          strokeWidth={mark.strokeWidth ?? 1}
          opacity={mark.opacity}
        >
          {title}
        </path>
      );
    }
    case "text": {
      return (
        <text
          x={mark.x}
          y={mark.y}
          textAnchor={mark.anchor ?? "middle"}
          fill={mark.fill ?? "currentColor"}
          fontSize="11"
        >
          {mark.text}
        </text>
      );
    }
    default: {
      throw new Error("Unknown SVG mark");
    }
  }
};

const SvgMark = ({ mark }: { mark: PlotMark }) => {
  const href = useFileLink(mark.file, undefined, mark.href);
  return href !== undefined && href !== "" ? (
    <a href={href}>
      <SvgShape mark={mark} />
    </a>
  ) : (
    <SvgShape mark={mark} />
  );
};

export const PlotView = ({
  title,
  model,
  id,
}: {
  title: string;
  model: PlotModel;
  id?: string;
}) => {
  const uid = useId();
  return (
    <DataPanel title={title} id={id} summary={model.summary}>
      <div className="overflow-x-auto p-3">
        <svg
          className="mx-auto h-auto w-full min-w-96"
          viewBox={`0 0 ${model.width} ${model.height}`}
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- An inline SVG needs its own accessible image role.
          role="img"
          aria-labelledby={`${uid}-title ${uid}-desc`}
        >
          <title id={`${uid}-title`}>{title}</title>
          <desc id={`${uid}-desc`}>
            {model.summary}. Data is available in the table below.
          </desc>
          {keyed(model.marks).map(({ key, value: mark }) => (
            <SvgMark key={key} mark={mark} />
          ))}
        </svg>
      </div>
      <details className="border-t border-neutral-200 p-3 text-sm dark:border-neutral-700">
        <summary className="cursor-pointer">Chart data</summary>
        <DataGrid rows={model.rows} />
        {model.metrics ? (
          <DataGrid rows={model.metrics} caption="Class metrics" />
        ) : null}
      </details>
    </DataPanel>
  );
};

import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { GAPS } from "./layout.js";

const COLS: Record<string, string> = {
  "1": "sm:grid-cols-1",
  "10": "sm:grid-cols-10",
  "11": "sm:grid-cols-11",
  "12": "sm:grid-cols-12",
  "2": "sm:grid-cols-2",
  "3": "sm:grid-cols-3",
  "4": "sm:grid-cols-4",
  "5": "sm:grid-cols-5",
  "6": "sm:grid-cols-6",
  "7": "sm:grid-cols-7",
  "8": "sm:grid-cols-8",
  "9": "sm:grid-cols-9",
};

const SPANS: Record<string, string> = {
  "1": "sm:col-span-1",
  "10": "sm:col-span-10",
  "11": "sm:col-span-11",
  "12": "sm:col-span-12",
  "2": "sm:col-span-2",
  "3": "sm:col-span-3",
  "4": "sm:col-span-4",
  "5": "sm:col-span-5",
  "6": "sm:col-span-6",
  "7": "sm:col-span-7",
  "8": "sm:col-span-8",
  "9": "sm:col-span-9",
  full: "sm:col-span-full",
};

const ROW_SPANS: Record<string, string> = {
  "1": "sm:row-span-1",
  "2": "sm:row-span-2",
  "3": "sm:row-span-3",
  "4": "sm:row-span-4",
};

const FLOWS: Record<string, string> = {
  col: "grid-flow-col",
  "col-dense": "grid-flow-col-dense",
  row: "",
  "row-dense": "grid-flow-row-dense",
};

const ITEMS: Record<string, string> = {
  center: "items-center",
  end: "items-end",
  start: "items-start",
  stretch: "",
};

const CSS_LENGTH = /^\d+(?:\.\d+)?(?:px|rem|em|ch|%|vw)$/u;

export const Grid = defineComponent(
  {
    description:
      '柔軟なグリッドレイアウト。cols(1-12) と <Cell span> で 2:1 やダッシュボード風の自由な配置に。min="12rem" 等を指定すると最小幅で自動折り返しするグリッドになる (cols は無視)。等幅だけなら <Columns> で十分',
    schema: v.looseObject({
      className: v.optional(v.string()),
      cols: v.optional(v.picklist(Object.keys(COLS)), "12"),
      flow: v.optional(
        v.picklist(["row", "col", "row-dense", "col-dense"]),
        "row"
      ),
      gap: v.optional(v.picklist(["none", "xs", "sm", "md", "lg", "xl"]), "md"),
      items: v.optional(
        v.picklist(["stretch", "start", "center", "end"]),
        "stretch"
      ),
      min: v.optional(
        v.pipe(
          v.string(),
          v.regex(CSS_LENGTH, "expected a CSS length like '12rem' or '200px'")
        )
      ),
    }),
  },
  ({ cols, min, gap, flow, items, className, children }) => {
    // auto-fit tracks work at every viewport (minmax collapses on narrow
    // screens); fixed cols stack to one column below `sm` like <Columns>.
    const tracks = nonEmpty(min)
      ? `grid-cols-[repeat(auto-fit,minmax(${min},1fr))]`
      : `grid-cols-1 ${COLS[cols]}`;
    return (
      <div
        className={`my-6 grid ${tracks} ${GAPS[gap]} ${FLOWS[flow]} ${ITEMS[items]} ${className ?? ""}`}
      >
        {children}
      </div>
    );
  }
);

export const Cell = defineComponent(
  {
    description:
      '<Grid> 内のセル。span="1-12|full" で列方向、rowSpan="1-4" で行方向の占有数を指定 (sm 以上で適用、モバイルでは縦積み)。className で任意のユーティリティを足せる',
    schema: v.looseObject({
      className: v.optional(v.string()),
      rowSpan: v.optional(v.picklist(Object.keys(ROW_SPANS)), "1"),
      span: v.optional(v.picklist(Object.keys(SPANS)), "1"),
    }),
  },
  ({ span, rowSpan, className, children }) => (
    <div
      className={`min-w-0 ${SPANS[span]} ${ROW_SPANS[rowSpan]} ${className ?? ""} [&>*:first-child]:mt-0 [&>*:last-child]:mb-0`}
    >
      {children}
    </div>
  )
);

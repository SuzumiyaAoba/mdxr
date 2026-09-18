import * as v from "valibot";

import { defineComponent } from "../define.js";
import { GAPS } from "./layout.js";

const ITEMS: Record<string, string> = {
  baseline: "items-baseline",
  center: "items-center",
  end: "items-end",
  start: "items-start",
  stretch: "",
};

export const Stack = defineComponent(
  {
    description:
      "縦積みレイアウト。余白を持たないコンポーネント (Input/Textarea 等の shadcn/ui プリミティブ) を gap 付きで縦に並べる",
    schema: v.looseObject({
      className: v.optional(v.string()),
      gap: v.optional(v.picklist(Object.keys(GAPS)), "md"),
      items: v.optional(
        v.picklist(["stretch", "start", "center", "end", "baseline"]),
        "stretch"
      ),
    }),
  },
  ({ gap, items, className, children }) => (
    <div
      className={`my-6 flex flex-col ${GAPS[gap]} ${ITEMS[items]} ${className ?? ""} [&>*:first-child]:mt-0 [&>*:last-child]:mb-0`}
    >
      {children}
    </div>
  )
);

export const Row = defineComponent(
  {
    description:
      "横並びレイアウト。Button/Badge などのインライン系コンポーネントを gap 付きで並べ、幅が足りなければ折り返す",
    schema: v.looseObject({
      className: v.optional(v.string()),
      gap: v.optional(v.picklist(Object.keys(GAPS)), "sm"),
      items: v.optional(
        v.picklist(["stretch", "start", "center", "end", "baseline"]),
        "center"
      ),
    }),
  },
  ({ gap, items, className, children }) => (
    <div
      className={`my-6 flex flex-wrap ${ITEMS[items]} ${GAPS[gap]} ${className ?? ""} [&>*:first-child]:mt-0 [&>*:last-child]:mb-0`}
    >
      {children}
    </div>
  )
);

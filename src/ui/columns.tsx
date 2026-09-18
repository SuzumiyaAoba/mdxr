import * as v from "valibot";

import { defineComponent } from "../define.js";
import { TRIM_CLS } from "./tones.js";

const COLS: Record<string, string> = {
  "1": "",
  "2": "sm:grid-cols-2",
  "3": "sm:grid-cols-3",
  "4": "sm:grid-cols-2 lg:grid-cols-4",
};

export const Columns = defineComponent(
  {
    description:
      "横並びレイアウト。cols は 1|2|3|4 (デフォルト 2)。<Column> を子に取る",
    schema: v.looseObject({
      cols: v.optional(v.picklist(["1", "2", "3", "4"]), "2"),
    }),
  },
  ({ cols, children }) => (
    <div className={`my-6 grid gap-4 ${COLS[cols]}`}>{children}</div>
  )
);

export const Column = defineComponent(
  {
    description: "<Columns> 内の1カラム",
  },
  ({ children }) => <div className={`min-w-0 ${TRIM_CLS}`}>{children}</div>
);

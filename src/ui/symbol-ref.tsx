import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { Icon } from "./icon.js";

export const SYMBOL_KINDS = [
  "class",
  "component",
  "const",
  "enum",
  "fn",
  "interface",
  "prop",
  "type",
] as const;
export type SymbolKind = (typeof SYMBOL_KINDS)[number];

const KIND_ICONS: Record<SymbolKind, string> = {
  class: "lucide:box",
  component: "lucide:puzzle",
  const: "lucide:variable",
  enum: "lucide:list-ordered",
  fn: "lucide:square-function",
  interface: "lucide:braces",
  prop: "lucide:tag",
  type: "lucide:type",
};

export const SymbolRef = defineComponent(
  {
    description:
      "コードシンボル (関数/型など) への参照チップ。kind でアイコンを出し分け、path/lines で定義場所を併記できる",
    schema: v.looseObject({
      kind: v.optional(v.picklist(SYMBOL_KINDS)),
      lines: v.optional(v.string()),
      name: v.string(),
      path: v.optional(v.string()),
    }),
  },
  ({ name, kind, path, lines }) => (
    <code className="not-prose mx-0.5 inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 align-baseline font-mono text-[0.85em] text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
      {kind === undefined ? null : (
        <Icon className="h-3.5 w-3.5 opacity-60" name={KIND_ICONS[kind]} />
      )}
      <span>
        {name}
        {nonEmpty(path) ? (
          <span className="opacity-60">
            {" "}
            · {path}
            {nonEmpty(lines) ? `:${lines}` : ""}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        data-copy={nonEmpty(path) ? path : name}
        className="rv-copy -mr-0.5 cursor-pointer opacity-40"
        title="Copy"
        aria-label="Copy"
      >
        <span className="rv-copy-idle inline-flex">
          <Icon className="h-3.5 w-3.5" name="lucide:copy" />
        </span>
        <span className="rv-copy-done hidden items-center text-emerald-600 dark:text-emerald-400">
          <Icon className="h-3.5 w-3.5" name="lucide:check" />
        </span>
      </button>
    </code>
  )
);

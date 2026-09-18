import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { FILE_LINK_PROPS } from "./attrs.js";
import { CopyButton } from "./bits.js";
import { linkTarget, useFileLink } from "./file-link.js";
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
      "コードシンボル (関数/型など) への参照チップ。kind でアイコンを出し分け、path/lines で定義場所を併記できる。実在する path はエディタリンク（既定 vscode://）になり、href で上書き可",
    schema: v.looseObject({
      ...FILE_LINK_PROPS,
      kind: v.optional(v.picklist(SYMBOL_KINDS)),
      name: v.string(),
    }),
  },
  ({ name, kind, path, lines, href }) => {
    const link = useFileLink(path, lines, href);
    const label = (
      <>
        {name}
        {nonEmpty(path) ? (
          <span className="opacity-60">
            {" "}
            · {path}
            {nonEmpty(lines) ? `:${lines}` : ""}
          </span>
        ) : null}
      </>
    );
    return (
      <code className="not-prose mx-0.5 inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 align-baseline font-mono text-[0.85em] text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
        {kind === undefined ? null : (
          <Icon className="h-3.5 w-3.5 opacity-60" name={KIND_ICONS[kind]} />
        )}
        {link === undefined ? (
          <span>{label}</span>
        ) : (
          <a
            className="text-inherit no-underline hover:underline"
            href={link}
            {...linkTarget(link)}
          >
            {label}
          </a>
        )}
        <CopyButton
          className="-mr-0.5 opacity-40"
          copy={nonEmpty(path) ? path : name}
          title="Copy"
        />
      </code>
    );
  }
);

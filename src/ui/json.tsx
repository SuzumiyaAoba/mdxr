import type { ReactElement } from "react";
import * as v from "valibot";

import { defineComponent, textOf } from "../define.js";
import { isRecord, nonEmpty } from "../guards.js";
import { attrFalse, BOOLISH_PROP } from "./attrs.js";
import { CaptionBar, CopyButton, FoldChev, Panel } from "./bits.js";
import { Icon } from "./icon.js";
import {
  CAPTION_TITLE_CLS,
  COUNT_CHIP_CLS,
  DISCLOSURE_ROW_CLS,
  RAIL_CLS,
  SUNKEN_CLS,
  TEXT,
  TREE_ROW_CLS,
} from "./tones.js";

/**
 * Collapsible JSON tree — objects/arrays fold via nested native <details>
 * (no client JS). The document supplies JSON as a `value` attribute or as a
 * fenced ```json block child; the fence's raw text is what gets parsed.
 */

const MAX_DEPTH = 32;
const MAX_STRING = 160;

const closed = attrFalse;

const Leaf = ({ value }: { value: unknown }): ReactElement => {
  if (value === null) {
    return (
      <span className="text-neutral-400 italic dark:text-neutral-500">
        null
      </span>
    );
  }
  if (typeof value === "string") {
    const s =
      value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
    return (
      <span className="break-all text-emerald-700 dark:text-emerald-400">
        {JSON.stringify(s)}
      </span>
    );
  }
  if (typeof value === "number") {
    return (
      <span className="text-sky-700 tabular-nums dark:text-sky-400">
        {String(value)}
      </span>
    );
  }
  if (typeof value === "boolean") {
    return (
      <span className="text-violet-700 dark:text-violet-400">
        {String(value)}
      </span>
    );
  }
  return <span>{JSON.stringify(value)}</span>;
};

const Key = ({ name }: { name: number | string }): ReactElement => (
  <>
    <span className="text-sky-700 dark:text-sky-300">
      {typeof name === "string" ? JSON.stringify(name) : name}
    </span>
    <span className={TEXT.faint}>:</span>
  </>
);

const NodeView = ({
  depth,
  name,
  openAll,
  value,
}: {
  depth: number;
  name?: number | string;
  openAll: boolean;
  value: unknown;
}): ReactElement => {
  const keyEl =
    name === undefined ? null : (
      <span className="inline-flex shrink-0 items-baseline gap-1">
        <Key name={name} />
      </span>
    );
  if (depth > MAX_DEPTH) {
    return (
      <div className={TREE_ROW_CLS}>
        {keyEl}
        <span className="text-neutral-400">…</span>
      </div>
    );
  }
  const isArr = Array.isArray(value);
  if (!isArr && !isRecord(value)) {
    return (
      <div className={TREE_ROW_CLS}>
        {keyEl}
        <Leaf value={value} />
      </div>
    );
  }
  const entries: [number | string, unknown][] = isArr
    ? value.map((item, i) => [i, item])
    : Object.entries(value);
  const openB = isArr ? "[" : "{";
  const closeB = isArr ? "]" : "}";
  if (entries.length === 0) {
    return (
      <div className={TREE_ROW_CLS}>
        {keyEl}
        <span className={TEXT.faint}>
          {openB}
          {closeB}
        </span>
      </div>
    );
  }
  return (
    <details className="group" open={openAll}>
      <summary className={`list-none ${DISCLOSURE_ROW_CLS}`}>
        <FoldChev />
        {keyEl}
        <span className={TEXT.faint}>{openB}</span>
        <span className={`mdxr-count ${COUNT_CHIP_CLS}`}>
          {entries.length} {isArr ? "items" : "keys"}
        </span>
      </summary>
      <div className={`ml-[1.05rem] border-l pl-2.5 ${RAIL_CLS}`}>
        {entries.map(([k, item]) => (
          <NodeView
            depth={depth + 1}
            key={k}
            name={k}
            openAll={openAll}
            value={item}
          />
        ))}
      </div>
      <div className={`ml-[1.05rem] ${TEXT.faint}`}>{closeB}</div>
    </details>
  );
};

export const Json = defineComponent(
  {
    description:
      '折りたたみ可能な JSON ツリー (ネストした <details>、JS 不要)。value 属性に JSON 文字列、または子に ```json フェンス。open="false" で全階層を折り畳み。title でキャプション+コピー',
    schema: v.looseObject({
      open: BOOLISH_PROP,
      title: v.optional(v.string()),
      value: v.optional(v.string()),
    }),
  },
  ({ title, open, value, children }) => {
    const text = nonEmpty(value) ? value : textOf(children).trim();
    if (!nonEmpty(text)) {
      throw new Error(
        "<Json> requires JSON text via the `value` attribute or a fenced block child"
      );
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`<Json> invalid JSON: ${msg}`, { cause: error });
    }
    return (
      <Panel className="mdxr-json">
        {nonEmpty(title) ? (
          <CaptionBar className={CAPTION_TITLE_CLS}>
            <Icon className="h-3.5 w-3.5" name="lucide:braces" />
            <span className="min-w-0 flex-1 truncate">{title}</span>
            <CopyButton copy={text} title="Copy JSON" />
          </CaptionBar>
        ) : null}
        <div
          className={`overflow-x-auto ${SUNKEN_CLS} px-4 py-3 font-mono text-[0.8125rem] leading-relaxed`}
        >
          <NodeView depth={0} openAll={!closed(open)} value={data} />
        </div>
      </Panel>
    );
  }
);

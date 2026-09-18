import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { attrTrue } from "./attrs.js";
import { CaptionBar, Panel } from "./bits.js";
import { BORDER_CLS, TEXT, TRIM_CLS } from "./tones.js";

export const Props = defineComponent(
  {
    description:
      "コンポーネント/関数の API 表コンテナ。of に対象名。<Prop> を子に取る",
    schema: v.looseObject({
      of: v.optional(v.string()),
    }),
  },
  ({ of, children }) => (
    <Panel>
      {nonEmpty(of) ? (
        <CaptionBar className="font-mono">{of}</CaptionBar>
      ) : null}
      <table className="m-0 w-full text-sm">
        <thead>
          <tr
            className={`border-b text-left text-xs ${BORDER_CLS} ${TEXT.muted}`}
          >
            <th className="py-2 pr-3 pl-4 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Default</th>
            <th className="py-2 pr-4 pl-3 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
          {children}
        </tbody>
      </table>
    </Panel>
  )
);

const isTruthy = (x: unknown): boolean => attrTrue(x) || x === "required";

export const Prop = defineComponent(
  {
    description:
      "API 表の1行。name は必須。type/default は文字列。required を付けると必須マーク。children は説明文",
    schema: v.looseObject({
      default: v.optional(v.string()),
      name: v.string(),
      required: v.optional(v.union([v.boolean(), v.string()])),
      type: v.optional(v.string()),
    }),
  },
  ({ name, type, required, default: def, children }) => (
    <tr>
      <td className="py-2 pr-3 pl-4 align-top font-mono text-[0.85em] whitespace-nowrap">
        {name}
        {isTruthy(required) ? (
          <span className="ml-0.5 text-red-500" title="required">
            *
          </span>
        ) : null}
      </td>
      <td
        className={`px-3 py-2 align-top font-mono text-[0.85em] ${TEXT.muted}`}
      >
        {type ?? ""}
      </td>
      <td
        className={`px-3 py-2 align-top font-mono text-[0.85em] ${TEXT.muted}`}
      >
        {nonEmpty(def) ? def : "—"}
      </td>
      <td className={`py-2 pr-4 pl-3 align-top ${TEXT.body} ${TRIM_CLS}`}>
        {children}
      </td>
    </tr>
  )
);

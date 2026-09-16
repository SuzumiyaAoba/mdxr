import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";

export const Props = defineComponent(
  {
    description:
      "コンポーネント/関数の API 表コンテナ。of に対象名。<Prop> を子に取る",
    schema: v.looseObject({
      of: v.optional(v.string()),
    }),
  },
  ({ of, children }) => (
    <figure className="not-prose my-4 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
      {nonEmpty(of) ? (
        <figcaption className="border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 font-mono text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          {of}
        </figcaption>
      ) : null}
      <table className="m-0 w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Default</th>
            <th className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
          {children}
        </tbody>
      </table>
    </figure>
  )
);

const isTruthy = (x: unknown): boolean =>
  x === true || x === "true" || x === "" || x === "required";

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
      <td className="px-3 py-2 align-top font-mono text-[0.85em] whitespace-nowrap">
        {name}
        {isTruthy(required) ? (
          <span className="ml-0.5 text-red-500" title="required">
            *
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 align-top font-mono text-[0.85em] text-neutral-500 dark:text-neutral-400">
        {type ?? ""}
      </td>
      <td className="px-3 py-2 align-top font-mono text-[0.85em] text-neutral-500 dark:text-neutral-400">
        {nonEmpty(def) ? def : "—"}
      </td>
      <td className="px-3 py-2 align-top text-neutral-600 dark:text-neutral-300 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {children}
      </td>
    </tr>
  )
);

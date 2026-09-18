import { createContext, useContext } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { attrTrue } from "./attrs.js";
import { CaptionBar } from "./bits.js";
import { Icon } from "./icon.js";
import { TONE } from "./tones.js";

export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

const METHODS: Record<string, string> = {
  DELETE: TONE.red,
  GET: TONE.emerald,
  HEAD: TONE.neutral,
  OPTIONS: TONE.neutral,
  PATCH: TONE.amber,
  POST: TONE.sky,
  PUT: TONE.violet,
};

/** `base` prefix from <Endpoints>, prepended (muted) to each endpoint path. */
const BaseCtx = createContext("");

const isTruthy = attrTrue;

export const Endpoint = defineComponent(
  {
    description:
      "API エンドポイント1行。method は HTTP メソッド (大小無視、色付きチップ)、path は必須。auth に認可名 (admin|token …)、deprecated で打ち消し+ピル。<Endpoints> の base がパスに前置される。children は説明文",
    schema: v.looseObject({
      auth: v.optional(v.string()),
      deprecated: v.optional(v.union([v.boolean(), v.string()])),
      method: v.optional(
        v.pipe(v.string(), v.toUpperCase(), v.picklist(HTTP_METHODS)),
        "GET"
      ),
      path: v.string(),
    }),
  },
  ({ method, path, auth, deprecated, children }) => {
    const base = useContext(BaseCtx);
    const isDeprecated = isTruthy(deprecated);
    return (
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
        <span
          className={`inline-flex w-15 shrink-0 items-center justify-center rounded px-1 py-0.5 font-mono text-[0.68rem] font-bold tracking-wide ${METHODS[method] ?? METHODS.GET}`}
        >
          {method}
        </span>
        <code
          className={`font-mono text-[0.85em] text-neutral-800 dark:text-neutral-200 ${isDeprecated ? "line-through opacity-60" : ""}`}
        >
          {nonEmpty(base) ? (
            <span className="text-neutral-400 dark:text-neutral-500">
              {base}
            </span>
          ) : null}
          {path}
        </code>
        {isDeprecated ? (
          <span className="inline-flex shrink-0 items-center rounded-full bg-neutral-100 px-1.5 py-px text-[0.65rem] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            Deprecated
          </span>
        ) : null}
        {nonEmpty(auth) ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-100 px-1.5 py-px text-[0.65rem] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            <Icon className="h-2.5 w-2.5" name="lucide:lock" />
            {auth}
          </span>
        ) : null}
        {children === undefined ? null : (
          <span className="min-w-0 flex-1 text-sm text-neutral-500 dark:text-neutral-400 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {children}
          </span>
        )}
      </div>
    );
  }
);

export const Endpoints = defineComponent(
  {
    description:
      "API エンドポイント一覧のコンテナ。<Endpoint> を並べる。title でキャプション、base で全行に付く共通パスプレフィックス",
    schema: v.looseObject({
      base: v.optional(v.string()),
      title: v.optional(v.string()),
    }),
  },
  ({ title, base, children }) => (
    <figure className="not-prose my-6 divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {nonEmpty(title) || nonEmpty(base) ? (
        <CaptionBar className="flex items-center gap-2 font-medium">
          <Icon className="h-3.5 w-3.5" name="lucide:route" />
          {nonEmpty(title) ? title : "Endpoints"}
          {nonEmpty(base) ? (
            <code className="ml-auto font-mono text-[0.7rem] font-normal text-neutral-400 dark:text-neutral-500">
              {base}
            </code>
          ) : null}
        </CaptionBar>
      ) : null}
      <BaseCtx.Provider value={nonEmpty(base) ? base : ""}>
        {children}
      </BaseCtx.Provider>
    </figure>
  )
);

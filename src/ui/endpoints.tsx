import { createContext, useContext } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { attrTrue, BOOLISH_PROP } from "./attrs.js";
import { CaptionBar, ListPanel, ListRow, RowNote } from "./bits.js";
import { Icon } from "./icon.js";
import { CAPTION_TITLE_CLS, MONO_CLS, TEXT, TONE, TRIM_CLS } from "./tones.js";

/** Tiny rounded chip (Deprecated/auth) inside an endpoint row. */
const MINI_CHIP = `inline-flex shrink-0 items-center gap-1 rounded-full bg-neutral-100 px-1.5 py-px text-[0.65rem] font-medium ${TEXT.muted} dark:bg-neutral-800`;

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

export const Endpoint = defineComponent(
  {
    description:
      "API エンドポイント1行。method は HTTP メソッド (大小無視、色付きチップ)、path は必須。auth に認可名 (admin|token …)、deprecated で打ち消し+ピル。<Endpoints> の base がパスに前置される。children は説明文",
    schema: v.looseObject({
      auth: v.optional(v.string()),
      deprecated: BOOLISH_PROP,
      method: v.optional(
        v.pipe(v.string(), v.toUpperCase(), v.picklist(HTTP_METHODS)),
        "GET"
      ),
      path: v.string(),
    }),
  },
  ({ method, path, auth, deprecated, children }) => {
    const base = useContext(BaseCtx);
    const isDeprecated = attrTrue(deprecated);
    return (
      <ListRow>
        <span
          className={`inline-flex w-15 shrink-0 items-center justify-center rounded px-1 py-0.5 font-mono text-[0.68rem] font-bold tracking-wide ${METHODS[method] ?? METHODS.GET}`}
        >
          {method}
        </span>
        <code
          className={`${MONO_CLS} ${isDeprecated ? "line-through opacity-60" : ""}`}
        >
          {nonEmpty(base) ? <span className={TEXT.faint}>{base}</span> : null}
          {path}
        </code>
        {isDeprecated ? <span className={MINI_CHIP}>Deprecated</span> : null}
        {nonEmpty(auth) ? (
          <span className={MINI_CHIP}>
            <Icon className="h-2.5 w-2.5" name="lucide:lock" />
            {auth}
          </span>
        ) : null}
        <RowNote className={TRIM_CLS}>{children}</RowNote>
      </ListRow>
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
    <ListPanel>
      {nonEmpty(title) || nonEmpty(base) ? (
        <CaptionBar className={CAPTION_TITLE_CLS}>
          <Icon className="h-3.5 w-3.5" name="lucide:route" />
          {nonEmpty(title) ? title : "Endpoints"}
          {nonEmpty(base) ? (
            <code
              className={`ml-auto font-mono text-[0.7rem] font-normal ${TEXT.faint}`}
            >
              {base}
            </code>
          ) : null}
        </CaptionBar>
      ) : null}
      <BaseCtx.Provider value={nonEmpty(base) ? base : ""}>
        {children}
      </BaseCtx.Provider>
    </ListPanel>
  )
);

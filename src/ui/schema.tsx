import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { attrTrue, BOOLISH_PROP } from "./attrs.js";
import { RowNote, Section } from "./bits.js";
import { Icon } from "./icon.js";
import {
  BORDER_CLS,
  LOC_CLS,
  MINI_CHIP_CLS,
  SURFACE_CLS,
  TEXT,
  TEXT_SUB,
  TONE,
  TRIM_CLS,
} from "./tones.js";

export const DbField = defineComponent(
  {
    description:
      'テーブルカラム1行。name/type は必須。pk / fk="table.col" / unique / null で制約チップ、default で既定値。children は説明文',
    schema: v.looseObject({
      default: v.optional(v.string()),
      fk: v.optional(v.string()),
      name: v.string(),
      null: BOOLISH_PROP,
      pk: BOOLISH_PROP,
      type: v.string(),
      unique: BOOLISH_PROP,
    }),
  },
  ({ name, type, pk, fk, unique, null: nullable, default: def, children }) => (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-4 py-2">
      <span className={`w-40 shrink-0 font-mono text-[0.85em] ${TEXT.code}`}>
        {name}
      </span>
      <span className={`${MINI_CHIP_CLS} ${TONE.neutral} font-mono`}>
        {type}
      </span>
      {attrTrue(pk) ? (
        <span className={`${MINI_CHIP_CLS} ${TONE.amber}`}>
          <Icon className="h-2.5 w-2.5" name="lucide:key-round" />
          PK
        </span>
      ) : null}
      {nonEmpty(fk) ? (
        <span className={`${MINI_CHIP_CLS} ${TONE.sky}`}>
          <Icon className="h-2.5 w-2.5" name="lucide:link" />
          FK → {fk}
        </span>
      ) : null}
      {attrTrue(unique) ? (
        <span className={`${MINI_CHIP_CLS} ${TONE.violet}`}>unique</span>
      ) : null}
      {attrTrue(nullable) ? (
        <span className={`${MINI_CHIP_CLS} ${TONE.neutral}`}>null</span>
      ) : null}
      {nonEmpty(def) ? (
        <span className={`font-mono text-xs ${TEXT.faint}`}>= {def}</span>
      ) : null}
      <RowNote className={TRIM_CLS}>{children}</RowNote>
    </div>
  )
);

export const DbTable = defineComponent(
  {
    description:
      "テーブル定義ブロック。name は必須、note で補足 (エンジン・行数など)。<DbField> をカラム行として並べる",
    schema: v.looseObject({
      name: v.string(),
      note: v.optional(v.string()),
    }),
  },
  ({ name, note, children }) => (
    <div
      className={`not-prose mb-4 overflow-hidden rounded-lg border last:mb-0 ${BORDER_CLS}`}
    >
      <div
        className={`flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-4 py-2 text-xs ${BORDER_CLS} ${SURFACE_CLS}`}
      >
        <Icon className={`h-3.5 w-3.5 ${TEXT.faint}`} name="lucide:table-2" />
        <code className={`font-mono font-semibold ${TEXT.code}`}>{name}</code>
        {nonEmpty(note) ? (
          <span className={`ml-auto ${TEXT_SUB} ${TEXT.faint}`}>{note}</span>
        ) : null}
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
        {children}
      </div>
    </div>
  )
);

export const Schema = defineComponent(
  {
    description:
      "DB スキーマ定義のコンテナ。<DbTable> を並べる。title は見出し。マイグレーション計画・データモデル説明向け",
    schema: v.looseObject({
      engine: v.optional(v.string()),
      title: v.optional(v.string()),
    }),
  },
  ({ title, engine, children }) => (
    <Section title={title}>
      {nonEmpty(engine) ? (
        <div className={`mb-2 ${LOC_CLS}`}>{engine}</div>
      ) : null}
      {children}
    </Section>
  )
);

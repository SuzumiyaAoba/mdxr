import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { nonEmpty } from "../guards.js";
import { attrTrue, BOOLISH_PROP } from "./attrs.js";
import { CaptionBar, CopyButton, ListPanel, ListRow, RowNote } from "./bits.js";
import { isEl, propOf } from "./children.js";
import { Icon } from "./icon.js";
import {
  CAPTION_TITLE_CLS,
  COUNT_CHIP_CLS,
  MINI_CHIP_CLS,
  MONO_CLS,
  TEXT,
  TONE,
  TRIM_CLS,
} from "./tones.js";

const MASK = "••••••••";

export const EnvVar = defineComponent(
  {
    description:
      "環境変数1行。name は必須。required で必須チップ、value/default で値表示、secret で値をマスク (value 未指定でも secret 指定で MASK 表示)。children は説明文",
    schema: v.looseObject({
      default: v.optional(v.string()),
      name: v.string(),
      required: BOOLISH_PROP,
      secret: BOOLISH_PROP,
      value: v.optional(v.string()),
    }),
  },
  ({ name, required, value, default: def, secret, children }) => {
    const isSecret = attrTrue(secret);
    const shown = isSecret ? MASK : (value ?? def);
    return (
      <ListRow>
        <code className={`${MONO_CLS} font-medium`}>{name}</code>
        {attrTrue(required) ? (
          <span className={`${MINI_CHIP_CLS} ${TONE.amber}`}>required</span>
        ) : null}
        {shown === undefined || shown === "" ? null : (
          <code className={`font-mono text-xs ${TEXT.muted}`}>
            {nonEmpty(value) || isSecret ? "" : "default: "}
            {shown}
          </code>
        )}
        {isSecret ? (
          <span className={`${MINI_CHIP_CLS} ${TONE.violet}`}>
            <Icon className="h-2.5 w-2.5" name="lucide:key-round" />
            secret
          </span>
        ) : null}
        <RowNote className={TRIM_CLS}>{children}</RowNote>
      </ListRow>
    );
  }
);

export const EnvVars = defineComponent(
  {
    description:
      "環境変数一覧のコンテナ。<EnvVar> を並べる。title はキャプション、コピーボタンで変数名一覧をクリップボードにコピー可。セットアップ/デプロイ手順書向け",
    schema: v.looseObject({
      title: v.optional(v.string()),
    }),
  },
  ({ title, children }) => {
    const names = flattenChildren(children)
      .filter((n) => isEl(n, EnvVar))
      .map((n) => propOf(n, "name"))
      .filter((x): x is string => typeof x === "string");
    return (
      <ListPanel>
        {nonEmpty(title) || names.length > 0 ? (
          <CaptionBar className={CAPTION_TITLE_CLS}>
            <Icon className="h-3.5 w-3.5" name="lucide:settings-2" />
            {nonEmpty(title) ? title : "Environment variables"}
            <span className="ml-auto flex items-center gap-2">
              {names.length > 0 ? (
                <span className={COUNT_CHIP_CLS}>{names.length}</span>
              ) : null}
              {names.length > 0 ? (
                <CopyButton
                  copy={names.join("\n")}
                  title="Copy variable names"
                />
              ) : null}
            </span>
          </CaptionBar>
        ) : null}
        {children}
      </ListPanel>
    );
  }
);

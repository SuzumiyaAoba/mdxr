import * as v from "valibot";

import { defineComponent } from "../define.js";
import { TITLE_PROP } from "./attrs.js";
import { ListPanel, ListRow, RowIcon, RowNote, Tag } from "./bits.js";
import { MONO_CLS, TONE_TEXT } from "./tones.js";

export const DEP_KINDS = [
  "calls",
  "extends",
  "implements",
  "imports",
  "reads",
  "writes",
] as const;
export type DepKind = (typeof DEP_KINDS)[number];

const KINDS: Record<DepKind, { cls: string; icon: string }> = {
  calls: {
    cls: TONE_TEXT.sky,
    icon: "lucide:square-function",
  },
  extends: {
    cls: TONE_TEXT.violet,
    icon: "lucide:git-branch",
  },
  implements: {
    cls: TONE_TEXT.teal,
    icon: "lucide:layers",
  },
  imports: {
    cls: TONE_TEXT.neutral,
    icon: "lucide:package",
  },
  reads: {
    cls: TONE_TEXT.neutral,
    icon: "lucide:eye",
  },
  writes: {
    cls: TONE_TEXT.amber,
    icon: "lucide:pencil",
  },
};

export const Deps = defineComponent(
  {
    description:
      "依存関係エッジ一覧のコンテナ。<Dep> を並べる。title でキャプションバー",
    schema: v.looseObject(TITLE_PROP),
  },
  ({ title, children }) => <ListPanel title={title}>{children}</ListPanel>
);

export const Dep = defineComponent(
  {
    description:
      "依存エッジ1行。from → to。kind は imports|calls|extends|implements|reads|writes。children は注記",
    schema: v.looseObject({
      from: v.string(),
      kind: v.optional(v.picklist(DEP_KINDS), "imports"),
      to: v.string(),
    }),
  },
  ({ from, to, kind, children }) => {
    const k = KINDS[kind];
    return (
      <ListRow gapX="2">
        <code className={MONO_CLS}>{from}</code>
        <RowIcon name="lucide:arrow-right" />
        <code className={MONO_CLS}>{to}</code>
        <Tag className={k.cls} icon={k.icon}>
          {kind}
        </Tag>
        <RowNote>{children}</RowNote>
      </ListRow>
    );
  }
);

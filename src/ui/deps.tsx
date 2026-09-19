import * as v from "valibot";

import { defineComponent } from "../define.js";
import { TITLE_PROP } from "./attrs.js";
import { ListPanel, ListRow, RowIcon, RowNote, Tag } from "./bits.js";
import { MONO_CLS, TEXT } from "./tones.js";

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
    cls: "text-sky-600 dark:text-sky-400",
    icon: "lucide:square-function",
  },
  extends: {
    cls: "text-violet-600 dark:text-violet-400",
    icon: "lucide:git-branch",
  },
  implements: {
    cls: "text-teal-600 dark:text-teal-400",
    icon: "lucide:layers",
  },
  imports: {
    cls: TEXT.muted,
    icon: "lucide:package",
  },
  reads: {
    cls: TEXT.muted,
    icon: "lucide:eye",
  },
  writes: {
    cls: "text-amber-600 dark:text-amber-400",
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

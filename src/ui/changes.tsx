import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import {
  ListPanel,
  ListRow,
  MaybeLink,
  RowIcon,
  RowNote,
  Tag,
} from "./bits.js";
import { fileIcon } from "./file-icon.js";
import { useFileLink } from "./file-link.js";
import { LINK_CLS, MONO_CLS, TEXT, TONE_TEXT } from "./tones.js";

export const CHANGE_KINDS = ["add", "modify", "delete", "rename"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

const KINDS: Record<ChangeKind, { cls: string; icon: string; label: string }> =
  {
    add: {
      cls: TONE_TEXT.emerald,
      icon: "lucide:file-plus",
      label: "Add",
    },
    delete: {
      cls: TONE_TEXT.red,
      icon: "lucide:file-x",
      label: "Delete",
    },
    modify: {
      cls: TONE_TEXT.sky,
      icon: "lucide:file-pen",
      label: "Modify",
    },
    rename: {
      cls: TONE_TEXT.violet,
      icon: "lucide:file-symlink",
      label: "Rename",
    },
  };

export const Changes = defineComponent(
  {
    description: "変更ファイル一覧のコンテナ。<Change> を並べる",
  },
  ({ children }) => <ListPanel as="div">{children}</ListPanel>
);

export const Change = defineComponent(
  {
    description:
      "変更ファイル1行。kind は add|modify|delete|rename。rename 時は to に変更後パス。実在ファイルはエディタリンク（既定 vscode://）になり、href で上書き可。children は注記",
    schema: v.looseObject({
      href: v.optional(v.string()),
      kind: v.optional(v.picklist(CHANGE_KINDS), "modify"),
      path: v.string(),
      to: v.optional(v.string()),
    }),
  },
  ({ kind, path, to, href, children }) => {
    const k = KINDS[kind];
    const link = useFileLink(nonEmpty(to) ? to : path, undefined, href);
    const label = (
      <code className={MONO_CLS}>
        {path}
        {nonEmpty(to) ? (
          <span className={TEXT.faint}>
            {" → "}
            {to}
          </span>
        ) : null}
      </code>
    );
    return (
      <ListRow>
        <Tag className={k.cls} icon={k.icon}>
          {k.label}
        </Tag>
        <RowIcon name={fileIcon(nonEmpty(to) ? to : path)} />
        <MaybeLink className={LINK_CLS} href={link}>
          {label}
        </MaybeLink>
        <RowNote>{children}</RowNote>
      </ListRow>
    );
  }
);

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
import { MONO_CLS, TEXT } from "./tones.js";

export const CHANGE_KINDS = ["add", "modify", "delete", "rename"] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

const KINDS: Record<ChangeKind, { cls: string; icon: string; label: string }> =
  {
    add: {
      cls: "text-emerald-600 dark:text-emerald-400",
      icon: "lucide:file-plus",
      label: "Add",
    },
    delete: {
      cls: "text-red-600 dark:text-red-400",
      icon: "lucide:file-x",
      label: "Delete",
    },
    modify: {
      cls: "text-sky-600 dark:text-sky-400",
      icon: "lucide:file-pen",
      label: "Modify",
    },
    rename: {
      cls: "text-violet-600 dark:text-violet-400",
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
        <MaybeLink
          className="text-inherit no-underline hover:underline"
          href={link}
        >
          {label}
        </MaybeLink>
        <RowNote>{children}</RowNote>
      </ListRow>
    );
  }
);

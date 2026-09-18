import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { FILE_LINK_PROPS } from "./attrs.js";
import {
  ListPanel,
  ListRow,
  MaybeLink,
  PathLabel,
  RowIcon,
  RowNote,
  Tag,
} from "./bits.js";
import { fileIcon } from "./file-icon.js";
import { useFileLink } from "./file-link.js";
import { MONO_CLS, TEXT } from "./tones.js";

export const FILE_KINDS = [
  "config",
  "core",
  "docs",
  "entry",
  "generated",
  "test",
  "types",
] as const;

const KINDS: Record<string, { cls: string; icon: string }> = {
  config: {
    cls: TEXT.muted,
    icon: "lucide:settings",
  },
  core: {
    cls: "text-violet-600 dark:text-violet-400",
    icon: "lucide:layers",
  },
  docs: {
    cls: TEXT.muted,
    icon: "lucide:book-open",
  },
  entry: {
    cls: "text-sky-600 dark:text-sky-400",
    icon: "lucide:log-in",
  },
  generated: {
    cls: TEXT.muted,
    icon: "lucide:bot",
  },
  test: {
    cls: "text-amber-600 dark:text-amber-400",
    icon: "lucide:flask-conical",
  },
  types: {
    cls: "text-teal-600 dark:text-teal-400",
    icon: "lucide:braces",
  },
};

const FALLBACK_KIND = {
  cls: TEXT.muted,
  icon: "lucide:tag",
};

export const Files = defineComponent(
  {
    description:
      "関連ファイル一覧のコンテナ。<File> を並べる。title でキャプションバー",
    schema: v.looseObject({
      title: v.optional(v.string()),
    }),
  },
  ({ title, children }) => <ListPanel title={title}>{children}</ListPanel>
);

export const File = defineComponent(
  {
    description:
      "関連ファイル1行。path は必須、lines で行範囲を併記。実在ファイルはエディタリンク（既定 vscode://）になり、href で上書き可。アイコンはファイル名/拡張子から自動選択。kind は entry|core|types|config|test|docs|generated など（既知の値はアイコン/色付き、それ以外も表示可）。children は役割の注記",
    schema: v.looseObject({
      ...FILE_LINK_PROPS,
      kind: v.optional(v.string()),
      path: v.string(),
    }),
  },
  ({ path, lines, kind, href, children }) => {
    // hasOwn: `kind` is a free-form string — "toString" would otherwise pull
    // a function off the prototype instead of the fallback styling.
    let r: { cls: string; icon: string } | undefined;
    if (nonEmpty(kind)) {
      r = Object.hasOwn(KINDS, kind) ? KINDS[kind] : FALLBACK_KIND;
    }
    const link = useFileLink(path, lines, href);
    const label = (
      <code className={MONO_CLS}>
        <PathLabel lines={lines} linesClassName={TEXT.faint} path={path} />
      </code>
    );
    return (
      <ListRow>
        <RowIcon name={fileIcon(path)} />
        <MaybeLink
          className="text-inherit no-underline hover:underline"
          href={link}
        >
          {label}
        </MaybeLink>
        {r === undefined ? null : (
          <Tag className={r.cls} icon={r.icon}>
            {kind}
          </Tag>
        )}
        <RowNote>{children}</RowNote>
      </ListRow>
    );
  }
);

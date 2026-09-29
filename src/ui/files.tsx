import { createContext, useContext } from "react";
import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty, own } from "../guards.js";
import { FILE_LINK_PROPS, TITLE_PROP } from "./attrs.js";
import {
  CaptionBar,
  MaybeLink,
  Panel,
  PathLabel,
  RowIcon,
  Tag,
} from "./bits.js";
import { fileIcon } from "./file-icon.js";
import { useFileLink } from "./file-link.js";
import {
  BORDER_CLS,
  DIVIDE_CLS,
  LINK_CLS,
  MONO_CLS,
  TEXT,
  TONE_TEXT,
  TRIM_CLS,
} from "./tones.js";

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
    cls: TONE_TEXT.neutral,
    icon: "lucide:settings",
  },
  core: {
    cls: TONE_TEXT.violet,
    icon: "lucide:layers",
  },
  docs: {
    cls: TONE_TEXT.neutral,
    icon: "lucide:book-open",
  },
  entry: {
    cls: TONE_TEXT.sky,
    icon: "lucide:log-in",
  },
  generated: {
    cls: TONE_TEXT.neutral,
    icon: "lucide:bot",
  },
  test: {
    cls: TONE_TEXT.amber,
    icon: "lucide:flask-conical",
  },
  types: {
    cls: TONE_TEXT.teal,
    icon: "lucide:braces",
  },
};

const FALLBACK_KIND = {
  cls: TONE_TEXT.neutral,
  icon: "lucide:tag",
};

const FilesContext = createContext(false);

export const Files = defineComponent(
  {
    description:
      "関連ファイル一覧の表。<File> の path・kind・本文を列で揃え、長い行は横スクロール。title でキャプションバー",
    schema: v.looseObject(TITLE_PROP),
  },
  ({ title, children }) => (
    <Panel>
      {nonEmpty(title) ? (
        <CaptionBar className="font-medium">{title}</CaptionBar>
      ) : null}
      <section
        aria-label={nonEmpty(title) ? title : "Files"}
        className="overflow-x-auto"
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The scroll viewport supports arrow keys even without file links.
        tabIndex={0}
      >
        <table
          aria-label={nonEmpty(title) ? title : "Files"}
          className="m-0 w-full text-left text-sm whitespace-nowrap"
        >
          <thead>
            <tr className={`border-b text-xs ${BORDER_CLS} ${TEXT.muted}`}>
              <th className="w-px py-2 pr-3 pl-4 font-medium" scope="col">
                Path
              </th>
              <th className="w-px px-3 py-2 font-medium" scope="col">
                Kind
              </th>
              <th className="py-2 pr-4 pl-3 font-medium" scope="col">
                Description
              </th>
            </tr>
          </thead>
          <tbody className={DIVIDE_CLS}>
            <FilesContext.Provider value={true}>
              {children}
            </FilesContext.Provider>
          </tbody>
        </table>
      </section>
    </Panel>
  )
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
    const inFiles = useContext(FilesContext);
    // `own`: `kind` is a free-form string — "toString" would otherwise pull
    // a function off the prototype instead of the fallback styling.
    let r: { cls: string; icon: string } | undefined;
    if (nonEmpty(kind)) {
      r = own(KINDS, kind) ?? FALLBACK_KIND;
    }
    const link = useFileLink(path, lines, href);
    const label = (
      <code className={MONO_CLS}>
        <PathLabel lines={lines} linesClassName={TEXT.faint} path={path} />
      </code>
    );
    const row = (
      <tr>
        <td className="py-2.5 pr-3 pl-4 align-top">
          <span className="inline-flex items-center gap-3">
            <RowIcon name={fileIcon(path)} />
            <MaybeLink className={LINK_CLS} href={link}>
              {label}
            </MaybeLink>
          </span>
        </td>
        <td className="px-3 py-2.5 align-top">
          {r === undefined ? null : (
            <Tag className={r.cls} icon={r.icon}>
              {kind}
            </Tag>
          )}
        </td>
        <td className={`py-2.5 pr-4 pl-3 align-top ${TEXT.muted} ${TRIM_CLS}`}>
          {children}
        </td>
      </tr>
    );
    return inFiles ? row : <Files>{row}</Files>;
  }
);

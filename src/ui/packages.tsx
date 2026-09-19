import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { nonEmpty, safeHref } from "../guards.js";
import { NUMISH } from "./attrs.js";
import { CaptionBar, ListPanel, ListRow, MaybeLink, RowNote } from "./bits.js";
import { isEl } from "./children.js";
import { Icon } from "./icon.js";
import {
  CAPTION_TITLE_CLS,
  COUNT_CHIP_CLS,
  LOC_CLS,
  MINI_CHIP_CLS,
  TEXT,
  TONE,
  TRIM_CLS,
} from "./tones.js";

export const PACKAGE_KINDS = ["dep", "dev", "peer", "optional"] as const;
export type PackageKind = (typeof PACKAGE_KINDS)[number];

const PKG_STYLES: Record<PackageKind, { cls: string; label: string }> = {
  dep: { cls: TONE.sky, label: "dep" },
  dev: { cls: TONE.neutral, label: "dev" },
  optional: { cls: TONE.amber, label: "optional" },
  peer: { cls: TONE.violet, label: "peer" },
};

export const Package = defineComponent(
  {
    description:
      "パッケージ棚卸し1行。name は必須、version、kind は dep|dev|peer|optional、license にライセンス名、href でレジストリ/リポジトリリンク。children は用途メモ",
    schema: v.looseObject({
      href: v.optional(v.string()),
      kind: v.optional(v.picklist(PACKAGE_KINDS)),
      license: v.optional(v.string()),
      name: v.string(),
      note: v.optional(v.string()),
      version: v.optional(NUMISH),
    }),
  },
  ({ name, version, kind, license, note, href, children }) => {
    const link = safeHref(href);
    return (
      <ListRow>
        <Icon
          className={`h-3.5 w-3.5 shrink-0 self-center ${TEXT.faint}`}
          name="lucide:package"
        />
        <MaybeLink
          className={`font-mono text-[0.85em] font-medium ${TEXT.code} no-underline hover:underline`}
          href={link}
        >
          {name}
        </MaybeLink>
        {version === undefined || version === "" ? null : (
          <code className={LOC_CLS}>{String(version)}</code>
        )}
        {kind === undefined ? null : (
          <span className={`${MINI_CHIP_CLS} ${PKG_STYLES[kind].cls}`}>
            {PKG_STYLES[kind].label}
          </span>
        )}
        {nonEmpty(license) ? (
          <span className={`${MINI_CHIP_CLS} ${TONE.neutral}`}>{license}</span>
        ) : null}
        {nonEmpty(note) ? (
          <span className={`text-sm ${TEXT.muted}`}>{note}</span>
        ) : null}
        <RowNote className={TRIM_CLS}>{children}</RowNote>
      </ListRow>
    );
  }
);

export const Packages = defineComponent(
  {
    description:
      "パッケージ一覧のコンテナ。<Package> を並べ、総数をキャプションに表示。title はキャプション",
    schema: v.looseObject({
      title: v.optional(v.string()),
    }),
  },
  ({ title, children }) => {
    const total = flattenChildren(children).filter((n) =>
      isEl(n, Package)
    ).length;
    const caption = nonEmpty(title) || total > 0;
    return (
      <ListPanel>
        {caption ? (
          <CaptionBar className={CAPTION_TITLE_CLS}>
            <Icon className="h-3.5 w-3.5" name="lucide:boxes" />
            {nonEmpty(title) ? title : "Packages"}
            {total > 0 ? (
              <span className={`ml-auto ${COUNT_CHIP_CLS}`}>{total}</span>
            ) : null}
          </CaptionBar>
        ) : null}
        {children}
      </ListPanel>
    );
  }
);

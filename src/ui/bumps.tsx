import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { isOneOf, nonEmpty, safeHref } from "../guards.js";
import { attrTrue, BOOLISH_PROP, NUMISH } from "./attrs.js";
import { CaptionBar, ListPanel, ListRow, MaybeLink, RowNote } from "./bits.js";
import { isEl, propOf } from "./children.js";
import { Icon } from "./icon.js";
import {
  CAPTION_TITLE_CLS,
  MINI_CHIP_CLS,
  TEXT,
  TONE,
  TRIM_CLS,
} from "./tones.js";

export const BUMP_KINDS = ["major", "minor", "patch"] as const;
export type BumpKind = (typeof BUMP_KINDS)[number];

const isBumpKind = isOneOf(BUMP_KINDS);

const KIND_STYLES: Record<BumpKind, { cls: string; label: string }> = {
  major: { cls: TONE.red, label: "major" },
  minor: { cls: TONE.amber, label: "minor" },
  patch: { cls: TONE.neutral, label: "patch" },
};

/** `"1.2.3"` → `[1, 2, 3]` — ignores pre-release/build suffixes. */
const semverParts = (x: unknown): number[] | undefined => {
  if (typeof x !== "string" && typeof x !== "number") {
    return undefined;
  }
  const m = /^v?(?<core>\d+(?:\.\d+){0,2})/u.exec(String(x).trim());
  if (m?.groups === undefined) {
    return undefined;
  }
  const parts = m.groups.core.split(".").map(Number);
  while (parts.length < 3) {
    parts.push(0);
  }
  return parts.every(Number.isFinite) ? parts : undefined;
};

/** Compare `from`/`to` semver triples → the highest differing segment. */
const detectKind = (from: unknown, to: unknown): BumpKind | undefined => {
  const a = semverParts(from);
  const b = semverParts(to);
  if (a === undefined || b === undefined) {
    return undefined;
  }
  for (const [i, kind] of [
    [0, "major"],
    [1, "minor"],
    [2, "patch"],
  ] as const) {
    if (a[i] !== b[i]) {
      return kind;
    }
  }
  return "patch";
};

export const Bump = defineComponent(
  {
    description:
      "依存バージョンアップ1行。name は必須、from → to を表示し major|minor|patch を自動判定 (kind で上書き可)。breaking で警告チップ、cves に修正される脆弱性数、href で変更履歴リンク。children はメモ",
    schema: v.looseObject({
      breaking: BOOLISH_PROP,
      cves: v.optional(NUMISH),
      from: v.optional(v.string()),
      href: v.optional(v.string()),
      kind: v.optional(v.picklist(BUMP_KINDS)),
      name: v.string(),
      note: v.optional(v.string()),
      to: v.optional(v.string()),
    }),
  },
  ({ name, from, to, kind, breaking, cves, note, href, children }) => {
    const k = isBumpKind(kind) ? kind : detectKind(from, to);
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
        {nonEmpty(from) || nonEmpty(to) ? (
          <span className="inline-flex items-center gap-1 font-mono text-xs">
            <span className={TEXT.muted}>{from ?? "?"}</span>
            <Icon
              className={`h-3 w-3 ${TEXT.faint}`}
              name="lucide:arrow-right"
            />
            <span className={TEXT.code}>{to ?? "?"}</span>
          </span>
        ) : null}
        {k === undefined ? null : (
          <span className={`${MINI_CHIP_CLS} ${KIND_STYLES[k].cls}`}>
            {KIND_STYLES[k].label}
          </span>
        )}
        {attrTrue(breaking) ? (
          <span className={`${MINI_CHIP_CLS} ${TONE.orange}`}>
            <Icon className="h-2.5 w-2.5" name="lucide:triangle-alert" />
            breaking
          </span>
        ) : null}
        {cves === undefined || cves === "" ? null : (
          <span className={`${MINI_CHIP_CLS} ${TONE.emerald}`}>
            <Icon className="h-2.5 w-2.5" name="lucide:shield-check" />
            {cves} {String(cves) === "1" ? "CVE" : "CVEs"}
          </span>
        )}
        {nonEmpty(note) ? (
          <span className={`text-sm ${TEXT.muted}`}>{note}</span>
        ) : null}
        <RowNote className={TRIM_CLS}>{children}</RowNote>
      </ListRow>
    );
  }
);

export const Bumps = defineComponent(
  {
    description:
      "依存バージョンアップ一覧のコンテナ。<Bump> を並べ、major|minor|patch 別の件数を自動集計。title はキャプション",
    schema: v.looseObject({
      title: v.optional(v.string()),
    }),
  },
  ({ title, children }) => {
    const counts = new Map<BumpKind, number>();
    for (const node of flattenChildren(children)) {
      if (!isEl(node, Bump)) {
        continue;
      }
      const k = propOf(node, "kind");
      const kind = isBumpKind(k)
        ? k
        : detectKind(propOf(node, "from"), propOf(node, "to"));
      if (kind !== undefined) {
        counts.set(kind, (counts.get(kind) ?? 0) + 1);
      }
    }
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const caption = nonEmpty(title) || total > 0;
    return (
      <ListPanel>
        {caption ? (
          <CaptionBar className={CAPTION_TITLE_CLS}>
            <Icon className="h-3.5 w-3.5" name="lucide:package-open" />
            {nonEmpty(title) ? title : "Dependency upgrades"}
            <span className="ml-auto flex items-center gap-x-2 font-medium">
              {BUMP_KINDS.map((k) => {
                const c = counts.get(k);
                return c === undefined ? null : (
                  <span
                    className={`${MINI_CHIP_CLS} ${KIND_STYLES[k].cls}`}
                    key={k}
                  >
                    {c} {k}
                  </span>
                );
              })}
            </span>
          </CaptionBar>
        ) : null}
        {children}
      </ListPanel>
    );
  }
);

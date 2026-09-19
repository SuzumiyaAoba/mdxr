import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty, safeHref } from "../guards.js";
import { attrTrue, BOOLISH_PROP } from "./attrs.js";
import {
  CaptionBar,
  ListPanel,
  ListRow,
  MaybeLink,
  Pill,
  RowNote,
} from "./bits.js";
import { countByProp } from "./children.js";
import { Icon } from "./icon.js";
import { isSeverity, SEVERITY_LEVELS, SEVERITY_STYLES } from "./severity.js";
import {
  CAPTION_TITLE_CLS,
  COUNT_CHIP_CLS,
  LOC_CLS,
  MONO_CLS,
  TEXT,
  TRIM_CLS,
} from "./tones.js";

export const Vuln = defineComponent(
  {
    description:
      "脆弱性1件。severity は critical|high|medium|low|info、id に CVE/GHSA 番号、package に対象パッケージ、affected に影響範囲、fix に修正バージョン、href でアドバイザリリンク、wontfix で対応外マーク。children は説明文",
    schema: v.looseObject({
      affected: v.optional(v.string()),
      fix: v.optional(v.string()),
      href: v.optional(v.string()),
      id: v.optional(v.string()),
      package: v.optional(v.string()),
      severity: v.optional(v.picklist(SEVERITY_LEVELS), "medium"),
      title: v.optional(v.string()),
      wontfix: BOOLISH_PROP,
    }),
  },
  ({
    severity,
    id,
    package: pkg,
    affected,
    fix,
    href,
    title,
    wontfix,
    children,
  }) => {
    const s = SEVERITY_STYLES[severity];
    const link = safeHref(href);
    return (
      <ListRow>
        <Pill className={s.chip} icon={s.icon}>
          {s.label}
        </Pill>
        <span className="min-w-0">
          {nonEmpty(title) ? (
            <span className="text-sm font-medium">{title}</span>
          ) : null}
          {nonEmpty(id) ? (
            <MaybeLink
              className={`${LOC_CLS} no-underline hover:underline ${nonEmpty(title) ? "ml-2" : ""}`}
              href={link}
            >
              {id}
            </MaybeLink>
          ) : null}
        </span>
        {nonEmpty(pkg) ? <code className={MONO_CLS}>{pkg}</code> : null}
        {nonEmpty(affected) ? (
          <code className={`${MONO_CLS} ${TEXT.muted}`}>{affected}</code>
        ) : null}
        {nonEmpty(fix) ? (
          <span
            className={`inline-flex shrink-0 items-center gap-1 font-mono text-xs ${TEXT.muted}`}
          >
            <Icon className="h-3 w-3" name="lucide:arrow-right" />
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {fix}
            </span>
          </span>
        ) : null}
        {attrTrue(wontfix) ? (
          <span className={`${COUNT_CHIP_CLS} uppercase`}>wontfix</span>
        ) : null}
        <RowNote className={TRIM_CLS}>{children}</RowNote>
      </ListRow>
    );
  }
);

export const Audit = defineComponent(
  {
    description:
      "脆弱性・監査結果のコンテナ。<Vuln> を並べる。title はキャプション、tool はスキャナ名チップ (npm audit, osv, trivy …)。severity 別の件数を自動集計",
    schema: v.looseObject({
      title: v.optional(v.string()),
      tool: v.optional(v.string()),
    }),
  },
  ({ title, tool, children }) => {
    const counts = countByProp(
      children,
      Vuln,
      "severity",
      isSeverity,
      "medium"
    );
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const caption = nonEmpty(title) || nonEmpty(tool) || total > 0;
    return (
      <ListPanel>
        {caption ? (
          <CaptionBar className={CAPTION_TITLE_CLS}>
            <Icon className="h-3.5 w-3.5" name="lucide:shield-alert" />
            {nonEmpty(title) ? title : "Audit"}
            {nonEmpty(tool) ? (
              <span className={COUNT_CHIP_CLS}>{tool}</span>
            ) : null}
            <span className="ml-auto flex items-center gap-x-2 font-medium">
              {SEVERITY_LEVELS.map((k) => {
                const c = counts.get(k);
                return c === undefined ? null : (
                  <Pill className={SEVERITY_STYLES[k].chip} key={k}>
                    {c} {SEVERITY_STYLES[k].label.toLowerCase()}
                  </Pill>
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

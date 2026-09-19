import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { FILE_LINK_PROPS, TITLE_PROP } from "./attrs.js";
import { LocLink, Section, TrimBody } from "./bits.js";
import { indexChildren, useChildIndex } from "./child-index.js";
import { Icon } from "./icon.js";
import { CHIP_BORDER_CLS, RAIL_BG_CLS, TEXT } from "./tones.js";

export const Flow = defineComponent(
  {
    description:
      "呼び出し・実行フローのコンテナ。<FlowStep> を番号付きで縦に連結する。title で見出し",
    schema: v.looseObject(TITLE_PROP),
  },
  ({ title, children }) => (
    <Section title={title}>
      <ol className="not-prose m-0 list-none p-0">{indexChildren(children)}</ol>
    </Section>
  )
);

export const FlowStep = defineComponent(
  {
    description:
      "フローの1ホップ。name は関数名や処理名、path/lines で発生箇所を併記（実在すればエディタリンク、href で上書き可）。children はその処理の説明",
    schema: v.looseObject({
      ...FILE_LINK_PROPS,
      name: v.optional(v.string()),
    }),
  },
  ({ name, path, lines, href, children }) => {
    const { n, last } = useChildIndex();
    return (
      <li className="relative pt-1 pb-4 pl-10 last:pb-0">
        {last ? null : (
          <span
            aria-hidden
            className={`absolute top-9 bottom-0 left-[13px] w-px ${RAIL_BG_CLS}`}
          />
        )}
        <span
          aria-hidden
          className={`bg-background absolute top-0 left-0 flex h-7 w-7 items-center justify-center rounded-full border ${CHIP_BORDER_CLS} font-mono text-xs font-medium ${TEXT.muted}`}
        >
          {n > 0 ? (
            n
          ) : (
            <Icon className="h-3.5 w-3.5" name="lucide:circle-dot" />
          )}
        </span>
        {nonEmpty(name) || nonEmpty(path) ? (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {nonEmpty(name) ? (
              <code
                className={`font-mono text-[0.85em] font-semibold ${TEXT.strong}`}
              >
                {name}
              </code>
            ) : null}
            {nonEmpty(path) ? (
              <LocLink href={href} lines={lines} path={path} />
            ) : null}
          </div>
        ) : null}
        <TrimBody className={`mt-1.5 text-sm ${TEXT.body}`}>
          {children}
        </TrimBody>
      </li>
    );
  }
);

import * as v from "valibot";

import { defineComponent } from "../define.js";
import { nonEmpty } from "../guards.js";
import { FILE_LINK_PROPS } from "./attrs.js";
import { indexChildren, useChildIndex } from "./child-index.js";
import { linkTarget, useFileLink } from "./file-link.js";
import { Icon } from "./icon.js";

export const Flow = defineComponent(
  {
    description:
      "呼び出し・実行フローのコンテナ。<FlowStep> を番号付きで縦に連結する。title で見出し",
    schema: v.looseObject({
      title: v.optional(v.string()),
    }),
  },
  ({ title, children }) => (
    <section className="my-6">
      {nonEmpty(title) ? <h3 className="mt-0">{title}</h3> : null}
      <ol className="not-prose m-0 list-none p-0">{indexChildren(children)}</ol>
    </section>
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
    const link = useFileLink(path, lines, href);
    const loc = (
      <>
        {path}
        {nonEmpty(lines) ? `:${lines}` : ""}
      </>
    );
    const locCls = "font-mono text-xs text-neutral-400 dark:text-neutral-500";
    const locEl =
      link === undefined ? (
        <span className={locCls}>{loc}</span>
      ) : (
        <a
          className={`${locCls} no-underline hover:underline`}
          href={link}
          {...linkTarget(link)}
        >
          {loc}
        </a>
      );
    return (
      <li className="relative pt-1 pb-4 pl-10 last:pb-0">
        {last ? null : (
          <span
            aria-hidden
            className="absolute top-9 bottom-0 left-[13px] w-px bg-neutral-200 dark:bg-neutral-700"
          />
        )}
        <span
          aria-hidden
          className="bg-background absolute top-0 left-0 flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 font-mono text-xs font-medium text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
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
              <code className="font-mono text-[0.9em] font-semibold text-neutral-900 dark:text-neutral-100">
                {name}
              </code>
            ) : null}
            {nonEmpty(path) ? locEl : null}
          </div>
        ) : null}
        {children === undefined ? null : (
          <div className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-300 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {children}
          </div>
        )}
      </li>
    );
  }
);

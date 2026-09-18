import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { attrFalse } from "./attrs.js";
import { Icon } from "./icon.js";

const closed = attrFalse;

/**
 * Table of contents. The `:::toc` directive / `<Toc>` element is a marker —
 * the remark plugin collects the document's headings, gives them `id`s, and
 * injects the link list as this component's children. `depth`/`min` are read
 * by the plugin at that point; the component itself frames the list as a
 * collapsible outline (native <details> — works without client JS).
 */
export const Toc = defineComponent(
  {
    description:
      '目次。見出し (h2〜) へのリンク一覧を自動生成する。depth="4" で深さ変更 (デフォルト 3)。open="false" で初期状態を折りたたみ。:::toc でも書ける',
    schema: v.looseObject({
      depth: v.optional(v.string()),
      min: v.optional(v.string()),
      open: v.optional(v.union([v.boolean(), v.string()])),
      title: v.optional(v.string()),
    }),
  },
  ({ title, open, children }) => {
    if (flattenChildren(children).length === 0) {
      return null;
    }
    return (
      <nav
        aria-label="Table of contents"
        className="mdxr-toc not-prose my-6 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
      >
        <details open={!closed(open)}>
          <summary className="flex cursor-pointer items-center gap-1.5 bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-500 transition-colors select-none hover:bg-neutral-100 active:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/70 dark:active:bg-neutral-800">
            <Icon className="h-3.5 w-3.5" name="lucide:list-tree" />
            <span className="flex-1">{title ?? "Contents"}</span>
            <Icon
              className="mdxr-chev h-3.5 w-3.5 opacity-50"
              name="lucide:chevron-right"
            />
          </summary>
          <div className="mdxr-toc-body border-t border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
            {children}
          </div>
        </details>
      </nav>
    );
  }
);

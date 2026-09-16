import * as v from "valibot";

import { defineComponent, flattenChildren } from "../define.js";
import { Icon } from "./icon.js";

/**
 * Table of contents. The `:::toc` directive / `<Toc>` element is a marker —
 * the remark plugin collects the document's headings, gives them `id`s, and
 * injects the link list as this component's children. `depth`/`min` are read
 * by the plugin at that point; the component itself only frames the list.
 */
export const Toc = defineComponent(
  {
    description:
      '目次。見出し (h2〜) へのリンク一覧を自動生成する。depth="4" で深さ変更 (デフォルト 3)。:::toc でも書ける',
    schema: v.looseObject({
      depth: v.optional(v.string()),
      min: v.optional(v.string()),
      title: v.optional(v.string()),
    }),
  },
  ({ title, children }) => {
    if (flattenChildren(children).length === 0) {
      return null;
    }
    return (
      <nav
        aria-label="Table of contents"
        className="not-prose my-6 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800"
      >
        <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          <Icon className="h-3.5 w-3.5" name="lucide:list" />
          {title ?? "Contents"}
        </div>
        <div className="px-4 py-3 text-sm [&_a]:text-neutral-600 [&_a]:no-underline [&_a]:transition-colors hover:[&_a]:text-neutral-900 dark:[&_a]:text-neutral-400 dark:hover:[&_a]:text-neutral-100 [&_ul]:m-0 [&_ul]:list-none [&_ul]:space-y-1 [&_ul]:p-0 [&_ul_ul]:mt-1 [&_ul_ul]:ml-4">
          {children}
        </div>
      </nav>
    );
  }
);

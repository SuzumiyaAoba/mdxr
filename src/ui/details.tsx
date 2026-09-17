import * as v from "valibot";

import { defineComponent } from "../define.js";
import { Icon } from "./icon.js";

/**
 * Collapsible section on native `<details>` — opens/closes without client
 * JS, unlike the shadcn Collapsible (which renders its initial state only).
 */
export const Details = defineComponent(
  {
    description:
      '折りたたみセクション (ネイティブ <details> — JS なしで開閉)。summary="..." で要約、open で初期展開',
    schema: v.looseObject({
      open: v.optional(v.union([v.boolean(), v.string()])),
      summary: v.optional(v.string()),
    }),
  },
  ({ summary, open, children }) => {
    const isOpen = open === true || open === "" || open === "true";
    return (
      <details
        className="rv-details my-6 rounded-lg border border-neutral-200 dark:border-neutral-800"
        open={isOpen}
      >
        <summary className="flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors select-none hover:bg-neutral-50 active:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-900 dark:active:bg-neutral-800">
          <Icon
            className="rv-chev h-4 w-4 shrink-0 text-neutral-400"
            name="lucide:chevron-right"
          />
          {summary ?? "Details"}
        </summary>
        <div className="border-t border-neutral-200 px-4 py-3 dark:border-neutral-800 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          {children}
        </div>
      </details>
    );
  }
);

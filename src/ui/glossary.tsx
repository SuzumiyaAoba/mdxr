import * as v from "valibot";

import { defineComponent } from "../define.js";

export const Glossary = defineComponent(
  {
    description: "用語集コンテナ。<Term> を並べる",
  },
  ({ children }) => (
    <dl className="not-prose my-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {children}
    </dl>
  )
);

export const Term = defineComponent(
  {
    description: "用語1項目。name が用語、children が定義文",
    schema: v.looseObject({
      name: v.string(),
    }),
  },
  ({ name, children }) => (
    <div className="px-4 py-2.5">
      <dt className="font-mono text-[0.85em] font-semibold text-neutral-900 dark:text-neutral-100">
        {name}
      </dt>
      <dd className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-300 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        {children}
      </dd>
    </div>
  )
);

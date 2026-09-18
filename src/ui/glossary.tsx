import * as v from "valibot";

import { defineComponent } from "../define.js";
import { ListPanel } from "./bits.js";
import { TEXT, TRIM_CLS } from "./tones.js";

export const Glossary = defineComponent(
  {
    description: "用語集コンテナ。<Term> を並べる",
  },
  ({ children }) => <ListPanel as="dl">{children}</ListPanel>
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
      <dt className={`font-mono text-[0.85em] font-semibold ${TEXT.strong}`}>
        {name}
      </dt>
      <dd className={`mt-0.5 text-sm ${TEXT.body} ${TRIM_CLS}`}>{children}</dd>
    </div>
  )
);

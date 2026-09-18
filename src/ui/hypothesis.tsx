import * as v from "valibot";

import { defineComponent } from "../define.js";
import { CountedList, IndexedCard, Pill } from "./bits.js";
import { useChildIndex } from "./child-index.js";
import { countByProp } from "./children.js";
import { TONE } from "./tones.js";

export const HYPOTHESIS_STATUSES = [
  "supported",
  "refuted",
  "untested",
] as const;
export type HypothesisStatus = (typeof HYPOTHESIS_STATUSES)[number];

export const isHypothesisStatus = (x: unknown): x is HypothesisStatus =>
  typeof x === "string" &&
  (HYPOTHESIS_STATUSES as readonly string[]).includes(x);

const STYLES: Record<
  HypothesisStatus,
  { cls: string; icon: string; label: string }
> = {
  refuted: {
    cls: TONE.red,
    icon: "lucide:circle-x",
    label: "Refuted",
  },
  supported: {
    cls: TONE.emerald,
    icon: "lucide:circle-check",
    label: "Supported",
  },
  untested: {
    cls: TONE.neutral,
    icon: "lucide:flask-conical",
    label: "Untested",
  },
};

export const Hypothesis = defineComponent(
  {
    description:
      "検証対象の仮説。status は supported|refuted|untested（支持された/棄却された/未検証）。title と children（検証内容・証拠）",
    schema: v.looseObject({
      status: v.optional(v.picklist(HYPOTHESIS_STATUSES), "untested"),
      title: v.optional(v.string()),
    }),
  },
  ({ status, title, children }) => {
    const { n } = useChildIndex();
    const s = STYLES[status];
    return (
      <IndexedCard
        n={n}
        pill={
          <Pill className={s.cls} icon={s.icon}>
            {s.label}
          </Pill>
        }
        title={title}
      >
        {children}
      </IndexedCard>
    );
  }
);

export const Hypotheses = defineComponent(
  {
    description:
      "仮説リストのコンテナ。<Hypothesis> を並べ、status 別の件数サマリを上部に表示",
    schema: v.looseObject({
      title: v.optional(v.string()),
    }),
  },
  ({ title, children }) => (
    <CountedList
      counts={countByProp(
        children,
        Hypothesis,
        "status",
        isHypothesisStatus,
        "untested"
      )}
      labelOf={(k) =>
        isHypothesisStatus(k) ? STYLES[k].label.toLowerCase() : k
      }
      noun={["hypothesis", "hypotheses"]}
      order={HYPOTHESIS_STATUSES}
      title={title}
    >
      {children}
    </CountedList>
  )
);

import * as v from "valibot";

import { defineComponent } from "../define.js";
import { isOneOf } from "../guards.js";
import { TITLE_PROP } from "./attrs.js";
import { CountedList, IndexedCard, Pill } from "./bits.js";
import { useChildIndex } from "./child-index.js";
import { countByProp } from "./children.js";
import { TONE } from "./tones.js";

export const CONFIDENCES = ["confirmed", "inferred", "unverified"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const isConfidence = isOneOf(CONFIDENCES);

const CONF: Record<Confidence, { cls: string; icon: string; label: string }> = {
  confirmed: {
    cls: TONE.emerald,
    icon: "lucide:badge-check",
    label: "Confirmed",
  },
  inferred: {
    cls: TONE.amber,
    icon: "lucide:lightbulb",
    label: "Inferred",
  },
  unverified: {
    cls: TONE.neutral,
    icon: "lucide:circle-dashed",
    label: "Unverified",
  },
};

export const Finding = defineComponent(
  {
    description:
      "調査の発見事項。confidence は confirmed|inferred|unverified（確証済み/推論/未検証）。title と children（根拠・証拠）",
    schema: v.looseObject({
      confidence: v.optional(v.picklist(CONFIDENCES), "confirmed"),
      title: v.optional(v.string()),
    }),
  },
  ({ confidence, title, children }) => {
    const { n } = useChildIndex();
    const c = CONF[confidence];
    return (
      <IndexedCard
        n={n}
        pill={
          <Pill className={c.cls} icon={c.icon}>
            {c.label}
          </Pill>
        }
        title={title}
      >
        {children}
      </IndexedCard>
    );
  }
);

export const Findings = defineComponent(
  {
    description:
      "発見事項リストのコンテナ。<Finding> を並べ、confidence 別の件数サマリを上部に表示",
    schema: v.looseObject(TITLE_PROP),
  },
  ({ title, children }) => (
    <CountedList
      counts={countByProp(
        children,
        Finding,
        "confidence",
        isConfidence,
        "confirmed"
      )}
      labelOf={(k) => (isConfidence(k) ? CONF[k].label.toLowerCase() : k)}
      noun={["finding", "findings"]}
      order={CONFIDENCES}
      title={title}
    >
      {children}
    </CountedList>
  )
);

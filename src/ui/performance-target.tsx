import { defineComponent } from "../define.js";
import {
  PERFORMANCE_LABELS,
  PERFORMANCE_TARGET_SCHEMA,
  performanceDetails,
  performanceResult,
} from "../research.js";
import { Pill, TrimBody } from "./bits.js";
import { BORDER_CLS, TEXT, TONE } from "./tones.js";

const STYLES = {
  met: { cls: TONE.emerald, icon: "lucide:check" },
  missed: { cls: TONE.red, icon: "lucide:x" },
  unmeasured: { cls: TONE.neutral, icon: "lucide:circle-dashed" },
} as const;

export const PerformanceTarget = defineComponent(
  {
    description:
      "Performance goal with separate target, actual, unit and conditions. Defaults to unmeasured; status=measured requires actual. better=lower|higher controls inclusive comparison. Never grades an unmeasured target.",
    schema: PERFORMANCE_TARGET_SCHEMA,
  },
  (props) => {
    const result = performanceResult(props);
    return (
      <section
        data-performance-result={result}
        className={`not-prose my-6 rounded-lg border px-4 py-3 ${BORDER_CLS}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-sm">{props.name}</strong>
          <Pill className={STYLES[result].cls} icon={STYLES[result].icon}>
            {PERFORMANCE_LABELS[result]}
          </Pill>
        </div>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          {performanceDetails(props).map(([label, value]) => (
            <div key={label}>
              <dt className={`text-xs ${TEXT.muted}`}>{label}</dt>
              <dd className="mt-1 break-words">{value}</dd>
            </div>
          ))}
        </dl>
        <TrimBody className="mt-3 text-sm">{props.children}</TrimBody>
      </section>
    );
  }
);

import { defineComponent } from "../define.js";
import { CLAIM_LABELS, RESEARCH_CLAIM_SCHEMA } from "../research.js";
import { Pill, TrimBody } from "./bits.js";
import { Cite } from "./document-references.js";
import { BORDER_CLS, TEXT, TONE } from "./tones.js";

const STYLES = {
  documented: { cls: TONE.sky, icon: "lucide:book-open" },
  inference: { cls: TONE.violet, icon: "lucide:git-branch" },
  proposal: { cls: TONE.indigo, icon: "lucide:lightbulb" },
  unknown: { cls: TONE.amber, icon: "lucide:circle-help" },
} as const;

export const ResearchClaim = defineComponent(
  {
    description:
      "Research claim: documented, inference, proposal or unknown. Documented/inference require a Source id; documented also requires checked (YYYY-MM-DD). Citations resolve at compile time.",
    schema: RESEARCH_CLAIM_SCHEMA,
  },
  ({
    kind,
    title,
    source,
    checked,
    id,
    citationId,
    sourceHref,
    sourceLabel,
    children,
  }) => (
    <section
      id={id}
      data-claim-kind={kind}
      className={`my-6 rounded-lg border px-4 py-3 ${BORDER_CLS}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Pill className={STYLES[kind].cls} icon={STYLES[kind].icon}>
          {CLAIM_LABELS[kind]}
        </Pill>
        {title === undefined ? null : (
          <strong className="text-sm">{title}</strong>
        )}
      </div>
      <TrimBody className="mt-2 text-sm">{children}</TrimBody>
      {source === undefined && checked === undefined ? null : (
        <div
          className={`mt-3 flex flex-wrap items-baseline gap-3 text-xs ${TEXT.muted}`}
        >
          {source === undefined ? null : (
            <span>
              Source{" "}
              <Cite
                source={source}
                href={sourceHref}
                label={sourceLabel}
                id={citationId}
              />
            </span>
          )}
          {checked === undefined ? null : (
            <span>
              Checked <time dateTime={checked}>{checked}</time>
            </span>
          )}
        </div>
      )}
    </section>
  )
);

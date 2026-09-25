import { parseProps } from "../define.js";
import {
  CLAIM_LABELS,
  PERFORMANCE_LABELS,
  PERFORMANCE_TARGET_SCHEMA,
  RESEARCH_CLAIM_SCHEMA,
  performanceDetails,
  performanceResult,
} from "../research.js";
import { attr, html, link, para, table, txt } from "./ast.js";
import type { AsciiRegistry, MdxTarget } from "./ast.js";
import { caption } from "./parts.js";

const attributes = (
  node: MdxTarget,
  names: string[]
): Record<string, string | undefined> =>
  Object.fromEntries(names.map((name) => [name, attr(node, name)]));

export const researchRenderers: AsciiRegistry = {
  PerformanceTarget: {
    flow: (node, ctx) => {
      const props = parseProps(
        PERFORMANCE_TARGET_SCHEMA,
        attributes(node, [
          "actual",
          "better",
          "conditions",
          "measuredAt",
          "name",
          "statistic",
          "status",
          "target",
          "unit",
        ]),
        "PerformanceTarget"
      );
      return [
        ...caption(
          props.name,
          ` — ${PERFORMANCE_LABELS[performanceResult(props)]}`
        ),
        table(["Field", "Value"], performanceDetails(props)),
        ...ctx.children(node),
      ];
    },
  },
  ResearchClaim: {
    flow: (node, ctx) => {
      const props = parseProps(
        RESEARCH_CLAIM_SCHEMA,
        attributes(node, [
          "checked",
          "citationId",
          "id",
          "kind",
          "source",
          "sourceHref",
          "sourceLabel",
          "title",
        ]),
        "ResearchClaim"
      );
      return [
        ...caption(props.title, ` — ${CLAIM_LABELS[props.kind]}`),
        ...ctx.children(node),
        ...(props.source === undefined || props.citationId === undefined
          ? []
          : [
              html(
                `<a id="${props.citationId.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}"></a>`
              ),
            ]),
        ...(props.source === undefined
          ? []
          : [
              para([
                txt("Source: "),
                link(props.sourceHref ?? `#${props.source}`, [
                  txt(props.sourceLabel ?? props.source),
                ]),
              ]),
            ]),
        ...(props.checked === undefined
          ? []
          : [para([txt(`Checked: ${props.checked}`)])]),
      ];
    },
  },
};

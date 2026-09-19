import type { Node, Parent } from "unist";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

import { isRecord, own } from "../guards.js";
import { isParent, textContent, toMdxElement } from "./ast.js";
import { CALLOUT_KINDS, normalizeCalloutKind } from "./callouts.js";

const CONTAINER_COMPONENTS: Record<string, string> = {
  board: "Board",
  deps: "Deps",
  endpoints: "Endpoints",
  files: "Files",
  finding: "Finding",
  findings: "Findings",
  flow: "Flow",
  gantt: "Gantt",
  graph: "Graph",
  hypotheses: "Hypotheses",
  hypothesis: "Hypothesis",
  matrix: "Matrix",
  phase: "Phase",
  plan: "Plan",
  search: "Search",
  searches: "Searches",
  steps: "Steps",
  summary: "Summary",
  terminal: "Terminal",
  tests: "Tests",
  timeline: "Timeline",
  toc: "Toc",
  trace: "Trace",
  waterfall: "Waterfall",
};

interface DirectiveNode extends Parent {
  name: string;
  attributes: Record<string, unknown>;
}

const isDirective = (n: Node): n is DirectiveNode =>
  "name" in n &&
  typeof n.name === "string" &&
  "attributes" in n &&
  isRecord(n.attributes) &&
  isParent(n);

/**
 * remark-directive containers become mdxr components:
 *   :::note[Optional label]        → <Callout kind="note" title="Optional label">
 *   :::phase{title="X" status="doing"} → <Phase title="X" status="doing">
 *   :::plan / :::steps / :::summary / :::timeline → Plan / Steps / Summary / Timeline
 *   :::flow / :::findings / :::finding / :::files / :::deps
 *     → Flow / Findings / Finding / Files / Deps
 *   :::terminal / :::trace / :::hypotheses / :::hypothesis / :::searches / :::search
 *     → Terminal / Trace / Hypotheses / Hypothesis / Searches / Search
 * `non-goal` is accepted as an alias of the `nongoal` callout kind.
 */
export const remarkMdxrDirectives = () => (tree: Node, file: VFile) => {
  visit(
    tree,
    ["containerDirective", "leafDirective", "textDirective"],
    (node: Node) => {
      if (!isDirective(node)) {
        return;
      }
      const directive = node;
      const name = normalizeCalloutKind(directive.name);
      const isContainer = directive.type === "containerDirective";
      // own-property lookup: `:::toString` would otherwise resolve to
      // Object.prototype.toString and be "rendered" as a component name.
      const container = own(CONTAINER_COMPONENTS, name);
      const component = CALLOUT_KINDS.has(name) ? "Callout" : container;
      if (component === undefined) {
        file.message(
          `Unknown directive ":::${directive.name}"`,
          directive,
          "mdxr:directives"
        );
        return;
      }
      if (!isContainer) {
        file.message(
          `:::${directive.name} is a container directive — use three colons`,
          directive,
          "mdxr:directives"
        );
        return;
      }

      const attrs: Record<string, unknown> = { ...directive.attributes };

      const [first] = directive.children;
      const isLabel =
        first !== undefined &&
        isRecord(first.data) &&
        first.data.directiveLabel === true;
      if (isLabel) {
        attrs.title ??= textContent(first).trim();
        directive.children.shift();
      }

      if (component === "Callout") {
        toMdxElement(directive, "mdxJsxFlowElement", "Callout", {
          kind: name,
          ...attrs,
        });
      } else {
        toMdxElement(directive, "mdxJsxFlowElement", component, attrs);
      }
    }
  );
};

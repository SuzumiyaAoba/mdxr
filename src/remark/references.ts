import type { Node } from "unist";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

import { isRecord } from "../guards.js";
import type { MdxTarget } from "./ast.js";
import { isParent, jsxAttr, textContent } from "./ast.js";

declare module "unist" {
  interface Data {
    mdxrReferenceId?: string;
  }
}

const isElement = (node: Node): node is MdxTarget =>
  node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";
const set = (node: MdxTarget, name: string, value: string): void => {
  const attrs: unknown[] = Array.isArray(node.attributes)
    ? node.attributes.filter((attr) => !(isRecord(attr) && attr.name === name))
    : [];
  node.attributes = [...attrs, { name, type: "mdxJsxAttribute", value }];
};
interface Reference {
  id: string;
  label: string;
  node: MdxTarget;
  kind: string;
}
interface ReferenceState {
  references: Map<string, Reference>;
  sources: Map<string, Reference>;
  counts: Map<string, number>;
  backlinks: Map<string, string[]>;
  citations: number;
  file: VFile;
}
const PREFIXES: Record<string, string> = {
  DataTable: "Table",
  Decision: "Decision",
  Figure: "Figure",
  Finding: "Finding",
  NumberedEquation: "Equation",
  Proof: "Proof",
  Req: "Requirement",
  Term: "Term",
  Theorem: "Theorem",
};
const INLINE_REFERENCES = new Set(["Cite", "CrossRef", "TermRef"]);
const REFERENCE_FEATURES = new Set([
  ...INLINE_REFERENCES,
  "Source",
  "TableOfFigures",
  "NumberedEquation",
  "Theorem",
]);
const NEEDS_ANCHOR = new Set(["Req", "Finding", "Decision", "Term"]);

const referenceLabel = (node: MdxTarget, id: string, count: number): string => {
  if (node.name === "Source") {
    return `[${count}]`;
  }
  const prefix = PREFIXES[node.name ?? ""];
  if (prefix) {
    return `${prefix} ${count}`;
  }
  return (
    jsxAttr(node, "title") ??
    jsxAttr(node, "caption") ??
    jsxAttr(node, "name") ??
    id
  );
};

const registerReference = (node: MdxTarget, state: ReferenceState): void => {
  const name = node.name ?? "";
  if (INLINE_REFERENCES.has(name)) {
    return;
  }
  const numbered = Boolean(PREFIXES[name]) || name === "Source";
  const count = (state.counts.get(name) ?? 0) + 1;
  if (numbered) {
    state.counts.set(name, count);
  }
  let id = jsxAttr(node, "id");
  if (name === "Term") {
    id ??= `term-${jsxAttr(node, "name") ?? ""}`;
  }
  if ((id === undefined || id === "") && numbered) {
    id = `mdxr-${name.toLowerCase()}-${count}`;
  }
  if (id === undefined || id === "") {
    return;
  }
  if (state.references.has(id)) {
    state.file.fail(`Duplicate reference id: ${id}`, node);
  }
  node.data = { ...node.data, mdxrReferenceId: id };
  set(node, "id", id);
  if (numbered) {
    set(node, "number", String(count));
  }
  const reference = {
    id,
    kind: name,
    label: referenceLabel(node, id, count),
    node,
  };
  state.references.set(id, reference);
  if (name === "Source") {
    state.sources.set(id, reference);
  }
};

const resolveCitation = (node: MdxTarget, state: ReferenceState): void => {
  const target = jsxAttr(node, "source") ?? "";
  const source = state.sources.get(target);
  if (!source) {
    state.file.fail(`Unknown citation source: ${target}`, node);
  }
  state.citations += 1;
  const id = `mdxr-citation-${state.citations}`;
  if (state.references.has(id)) {
    state.file.fail(`Duplicate reference id: ${id}`, node);
  }
  node.data = { ...node.data, mdxrReferenceId: id };
  set(node, "id", id);
  set(node, "href", `#${source.id}`);
  set(node, "label", source.label);
  const ids = state.backlinks.get(target) ?? [];
  ids.push(id);
  state.backlinks.set(target, ids);
};

const resolveCrossReference = (
  node: MdxTarget,
  state: ReferenceState
): void => {
  const target =
    jsxAttr(node, "target") ??
    (node.name === "TermRef" ? `term-${jsxAttr(node, "term") ?? ""}` : "");
  const reference = state.references.get(target);
  if (!reference) {
    state.file.fail(`Unknown cross reference: ${target}`, node);
  }
  set(node, "href", `#${reference.id}`);
  set(
    node,
    "label",
    jsxAttr(node, "label") ?? jsxAttr(reference.node, "name") ?? reference.label
  );
  set(node, "description", textContent(reference.node));
};

const listFigures = (
  node: MdxTarget,
  references: Map<string, Reference>
): void => {
  const kind = jsxAttr(node, "kind") ?? "Figure";
  node.children = [
    {
      children: [...references.values()]
        .filter((ref) => ref.kind === kind)
        .map((ref) => ({
          children: [
            {
              children: [
                {
                  children: [
                    {
                      type: "text",
                      value: `${ref.label}: ${jsxAttr(ref.node, "caption") ?? jsxAttr(ref.node, "title") ?? textContent(ref.node)}`,
                    },
                  ],
                  type: "link",
                  url: `#${ref.id}`,
                },
              ],
              type: "paragraph",
            },
          ],
          spread: false,
          type: "listItem",
        })),
      ordered: false,
      spread: false,
      type: "list",
    } as Node,
  ];
};

const addLegacyAnchor = (node: MdxTarget): void => {
  if (!NEEDS_ANCHOR.has(node.name ?? "") || !isParent(node)) {
    return;
  }
  const id = jsxAttr(node, "id");
  if (id === undefined || id === "") {
    return;
  }
  node.children.unshift({
    attributes: [{ name: "id", type: "mdxJsxAttribute", value: id }],
    children: [],
    name: "span",
    type: "mdxJsxTextElement",
  } as Node);
};

/** Two passes support forward references without changing older documents. */
export const remarkReferences = () => (tree: Node, file: VFile) => {
  const elements: MdxTarget[] = [];
  visit(tree, (node) => {
    if (isElement(node)) {
      elements.push(node);
    }
  });
  if (!elements.some((node) => REFERENCE_FEATURES.has(node.name ?? ""))) {
    return;
  }
  const state: ReferenceState = {
    backlinks: new Map(),
    citations: 0,
    counts: new Map(),
    file,
    references: new Map(),
    sources: new Map(),
  };
  for (const node of elements) {
    registerReference(node, state);
  }
  for (const node of elements) {
    if (node.name === "Cite") {
      resolveCitation(node, state);
    }
    if (node.name === "CrossRef" || node.name === "TermRef") {
      resolveCrossReference(node, state);
    }
    if (node.name === "TableOfFigures") {
      listFigures(node, state.references);
    }
    addLegacyAnchor(node);
  }
  for (const [source, ids] of state.backlinks) {
    const reference = state.sources.get(source);
    if (reference) {
      set(reference.node, "backlinks", ids.join(","));
    }
  }
};

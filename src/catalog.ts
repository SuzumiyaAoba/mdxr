import type { ComponentMap } from "./define.js";
import { isRecord } from "./guards.js";
import { builtinComponents } from "./ui/index.js";

export interface PropInfo {
  type: string;
  required: boolean;
  default?: unknown;
}

export interface CatalogEntry {
  name: string;
  source: "builtin" | "project";
  description?: string;
  props: Record<string, PropInfo>;
}

/** Structural view of a valibot schema — enough for catalog introspection. */
const describeSchema = (schema: unknown): string => {
  if (!isRecord(schema)) {
    return "unknown";
  }
  if (schema.type === "array") {
    return `${describeSchema(schema.item)}[]`;
  }
  if (schema.type === "literal") {
    return JSON.stringify(schema.literal);
  }
  if (schema.type === "picklist" && Array.isArray(schema.options)) {
    return schema.options.map((o: unknown) => JSON.stringify(o)).join(" | ");
  }
  if (schema.type === "union" && Array.isArray(schema.options)) {
    return schema.options.map(describeSchema).join(" | ");
  }
  // `v.pipe(v.string(), v.toUpperCase(), v.picklist(M))` keeps `type:
  // "string"` — the base type — and stores the actions in `.pipe`. The
  // constrained member (picklist/union/literal) reads better than "string";
  // transforms like trim/case don't describe accepted values.
  if (Array.isArray(schema.pipe)) {
    const pipe: unknown[] = schema.pipe;
    const constrained = pipe.find(
      (s) =>
        isRecord(s) &&
        (s.type === "picklist" || s.type === "union" || s.type === "literal")
    );
    if (constrained !== undefined) {
      return describeSchema(constrained);
    }
  }
  return typeof schema.type === "string" ? schema.type : "unknown";
};

// Wrapper schema types that mark a prop as non-required and may carry a
// `default` (valibot's optional/nullish/nullable).
const WRAPPER_TYPES = new Set(["nullable", "nullish", "optional"]);

const unwrapProp = (
  raw: unknown
): { def: unknown; required: boolean; s: Record<string, unknown> } => {
  let s: Record<string, unknown> = isRecord(raw) ? raw : {};
  let required = true;
  let def: unknown;
  while (typeof s.type === "string" && WRAPPER_TYPES.has(s.type)) {
    required = false;
    // First (outermost) default wins: `v.optional(v.nullable(x, "a"), "b")`
    // yields "b" for an absent prop — the inner default never applies.
    def ??= s.default;
    s = isRecord(s.wrapped) ? s.wrapped : {};
  }
  return { def, required, s };
};

const propsOf = (schema: unknown): Record<string, PropInfo> => {
  if (!isRecord(schema) || !isRecord(schema.entries)) {
    return {};
  }
  const out: Record<string, PropInfo> = {};
  for (const [key, raw] of Object.entries(schema.entries)) {
    const { def, required, s } = unwrapProp(raw);
    // defineProperty, not assignment: a prop literally named "__proto__"
    // would otherwise replace `out`'s prototype instead of being recorded.
    Object.defineProperty(out, key, {
      configurable: true,
      enumerable: true,
      value: {
        required,
        type: describeSchema(s),
        ...(def === undefined ? {} : { default: def }),
      },
      writable: true,
    });
  }
  return out;
};

const entryOf = (
  name: string,
  comp: ComponentMap[string],
  source: CatalogEntry["source"]
): CatalogEntry => ({
  description: comp.__mdxr?.description,
  name,
  props: propsOf(comp.__mdxr?.schema),
  source,
});

export const catalogEntries = (project: ComponentMap = {}): CatalogEntry[] => {
  const entries: CatalogEntry[] = [];
  for (const [name, comp] of Object.entries(builtinComponents)) {
    // The `pre` override is a convention, not a JSX component.
    if (!/^[A-Z]/u.test(name)) {
      continue;
    }
    // A project override wins the slot wholesale: describe its schema, not
    // the builtin's — the catalog documents what the document actually gets.
    // hasOwn, not `in`: prototype names ("toString", "constructor") must not
    // count as overrides via the prototype chain.
    const overridden = Object.hasOwn(project, name);
    const shown = overridden ? (project[name] ?? comp) : comp;
    entries.push(entryOf(name, shown, overridden ? "project" : "builtin"));
  }
  for (const [name, comp] of Object.entries(project)) {
    if (!Object.hasOwn(builtinComponents, name)) {
      entries.push(entryOf(name, comp, "project"));
    }
  }
  return entries;
};

/** Conventions the agent can use without JSX (kept in sync with remark plugins). */
export const CONVENTIONS = [
  {
    result: "Callout (with kind)",
    syntax:
      ":::note | :::tip | :::warning | :::danger | :::decision | :::goal | :::nongoal | :::question | :::answer",
  },
  { result: "Phase", syntax: ':::phase{title="..." status="doing"}' },
  { result: "Steps container", syntax: ":::steps" },
  {
    result: "Flow (numbered call/execution chain)",
    syntax: ':::flow{title="..."}',
  },
  {
    result: "Findings container / Finding block",
    syntax: ':::findings · :::finding{confidence="inferred" title="..."}',
  },
  { result: "Files container (related files)", syntax: ":::files" },
  { result: "Deps container (dependency edges)", syntax: ":::deps" },
  { result: "Tests container (test report)", syntax: ":::tests" },
  { result: "Endpoints container (API routes)", syntax: ":::endpoints" },
  { result: "Board container (kanban)", syntax: ":::board" },
  {
    result: "Graph container (static node/edge SVG, dagre layout)",
    syntax: ':::graph{title="..." direction="right"}',
  },
  { result: "Waterfall container (timing bars)", syntax: ":::waterfall" },
  {
    result: "Gantt container (date-based schedule)",
    syntax: ':::gantt{title="..."}',
  },
  { result: "Matrix container (comparison grid)", syntax: ":::matrix" },
  { result: "Timeline", syntax: ':::timeline{title="..."}' },
  { result: "table of contents (auto from headings)", syntax: ":::toc" },
  { result: "Callout (GitHub alert)", syntax: "> [!NOTE] / [!WARNING] / ..." },
  { result: "diagram (mermaid via CDN)", syntax: "```mermaid fenced block" },
  {
    result: "unified-diff cards (per-file headers, hunk line numbers)",
    syntax: "```diff or ```patch fenced block",
  },
  { result: "math (KaTeX via CDN)", syntax: "$…$ inline / $$…$$ block" },
  {
    result: "code block (syntax-highlighted) with filename header",
    syntax: '```lang title="file.ts"',
  },
  {
    result: "FileRef chip (editor link when the file exists)",
    syntax: "`src/x.ts` inline code naming a real file",
  },
  {
    result: "code line highlights / line numbers",
    syntax: "```ts {1,3-5} · ```ts ln · /word/ in meta",
  },
  {
    result: "in-code markers (stripped from output)",
    syntax:
      "// [!code hl] · [!code ++] · [!code --] · [!code warning] · [!code error] · [!code focus] · [!code word:x]",
  },
  {
    result: "embed a real file as a code block",
    syntax: '<CodeFile path="src/x.ts" lines="40-52" />',
  },
  {
    result: "styled markdown",
    syntax: "GFM tables, task lists, strikethrough, footnotes",
  },
  {
    result: "Iconify icon (inline SVG, lucide + vscode-icons bundled)",
    syntax: '<Icon name="lucide:rocket"> or class="icon-[lucide--rocket]"',
  },
];

export const formatCatalog = (entries: CatalogEntry[]): string => {
  const lines: string[] = ["Components:", ""];
  for (const e of entries) {
    const props = Object.entries(e.props)
      .map(([k, p]) => `${k}${p.required ? "" : "?"}: ${p.type}`)
      .join(", ");
    lines.push(`  <${e.name}${props === "" ? "" : ` ${props}`}>`);
    if (e.description !== undefined) {
      lines.push(`      ${e.description}`);
    }
    if (e.source === "project") {
      lines.push("      (project-defined)");
    }
    lines.push("");
  }
  lines.push("Conventions:");
  for (const c of CONVENTIONS) {
    lines.push(`  ${c.syntax}  →  ${c.result}`);
  }
  return lines.join("\n");
};

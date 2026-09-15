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
  return typeof schema.type === "string" ? schema.type : "unknown";
};

const propsOf = (schema: unknown): Record<string, PropInfo> => {
  if (!isRecord(schema) || !isRecord(schema.entries)) {
    return {};
  }
  const out: Record<string, PropInfo> = {};
  for (const [key, raw] of Object.entries(schema.entries)) {
    let s: Record<string, unknown> = isRecord(raw) ? raw : {};
    let required = true;
    let def: unknown;
    while (
      s.type === "optional" ||
      s.type === "nullish" ||
      s.type === "nullable"
    ) {
      required = false;
      if (s.default !== undefined) {
        def = s.default;
      }
      s = isRecord(s.wrapped) ? s.wrapped : {};
    }
    out[key] = {
      required,
      type: describeSchema(s),
      ...(def === undefined ? {} : { default: def }),
    };
  }
  return out;
};

export const catalogEntries = (project: ComponentMap = {}): CatalogEntry[] => {
  const entries: CatalogEntry[] = [];
  for (const [name, comp] of Object.entries(builtinComponents)) {
    // The `pre` override is a convention, not a JSX component.
    if (!/^[A-Z]/u.test(name)) {
      continue;
    }
    entries.push({
      description: comp.__rv?.description,
      name,
      props: propsOf(comp.__rv?.schema),
      source: name in project ? "project" : "builtin",
    });
  }
  for (const [name, comp] of Object.entries(project)) {
    if (name in builtinComponents) {
      continue;
    }
    entries.push({
      description: comp.__rv?.description,
      name,
      props: propsOf(comp.__rv?.schema),
      source: "project",
    });
  }
  return entries;
};

/** Conventions the agent can use without JSX (kept in sync with remark plugins). */
export const CONVENTIONS = [
  {
    result: "Callout (with kind)",
    syntax: ":::note | :::tip | :::warning | :::danger | :::decision",
  },
  { result: "Phase", syntax: ':::phase{title="..." status="doing"}' },
  { result: "Steps container", syntax: ":::steps" },
  { result: "Callout (GitHub alert)", syntax: "> [!NOTE] / [!WARNING] / ..." },
  { result: "diagram (mermaid via CDN)", syntax: "```mermaid fenced block" },
  {
    result: "code block with filename header",
    syntax: '```lang title="file.ts"',
  },
  {
    result: "styled markdown",
    syntax: "GFM tables, task lists, strikethrough",
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

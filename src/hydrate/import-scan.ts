/**
 * User-module import scanning: which names an importer pulls from
 * `@suzumiyaaoba/mdxr`(/components), and which valibot properties it accesses
 * through
 * an imported `v` alias. The virtual runtime module generated for each
 * importer contains only what it requests — a full-surface module would
 * drag the whole catalog into every hydration bundle.
 */

import { readFile } from "node:fs/promises";

export interface MdxrImports {
  /** Named imports the file requests, or `"all"` when it needs the whole API. */
  names: Set<string> | "all";
  /**
   * Properties accessed on the imported `v`, or `"all"` when `v` escapes
   * (bare use, re-export, dynamic access) so the whole namespace is needed.
   * `null` when `v` is not imported.
   */
  vProps: Set<string> | "all" | null;
}

/**
 * Properties accessed on `alias` (`v`'s local name) — or `"all"` when the
 * namespace escapes (bare use, `alias[key]`, spread, re-export) and the full
 * valibot namespace must be shipped.
 */
const scanVProps = (stripped: string, alias: string): Set<string> | "all" => {
  const esc = alias.replaceAll(/[$()*+.?[\\\]^{|}]/gu, "\\$&");
  const access = new RegExp(
    `\\b${esc}\\s*\\?\\.\\s*(\\w+)|\\b${esc}\\s*\\.\\s*(\\w+)`,
    "gu"
  );
  const props = new Set<string>();
  for (const use of stripped.matchAll(access)) {
    const prop = use[1] ?? use[2];
    if (prop !== undefined) {
      props.add(prop);
    }
  }
  const leftover = stripped.replaceAll(access, "");
  return new RegExp(`\\b${esc}\\b`, "u").test(leftover) ? "all" : props;
};

/**
 * `/* … *\/` and `// …` are legal inside a multiline import clause, and a
 * name polluted with comment text would silently fail the surface check and
 * kill the hydration build. Clauses never contain string literals, so a
 * regex strip is safe here.
 */
const stripComments = (s: string): string =>
  s.replaceAll(/\/\*[\s\S]*?\*\//gu, "").replaceAll(/\/\/[^\n]*/gu, "");

/** Parse `{ a, b as c, type T }` import specifiers into names + `v` aliases. */
const parseClause = (
  clause: string,
  names: Set<string>,
  vAliases: string[]
): void => {
  // The clause may trail past `}` — comments between `}` and `from` are legal
  // (`import {a} /* x */ from "m"`) and the regex captures them. Strip
  // comments first (a `}` inside one is comment text), then cut at the last
  // `}` so `{ a } /* c */` reads as `a`, not `a }`.
  const inner = stripComments(clause);
  const close = inner.lastIndexOf("}");
  const body = close === -1 ? inner.slice(1) : inner.slice(1, close);
  for (const part of body.split(",")) {
    const spec = part.trim().replace(/^type\s+/u, "");
    const [imported, local] = spec.split(/\s+as\s+/u).map((s) => s?.trim());
    if (imported === undefined || imported === "") {
      continue;
    }
    names.add(imported);
    if (imported === "v") {
      vAliases.push(local ?? "v");
    }
  }
};

/** Merge per-alias prop scans — `"all"` once any alias escapes. */
const mergeVProps = (
  stripped: string,
  vAliases: string[],
  escapes: boolean
): Set<string> | "all" | null => {
  if (escapes) {
    return "all";
  }
  let vProps: Set<string> | null = null;
  for (const alias of vAliases) {
    const props = scanVProps(stripped, alias);
    if (props === "all") {
      return "all";
    }
    vProps = vProps === null ? props : new Set([...vProps, ...props]);
  }
  return vProps;
};

/**
 * Which names `importer` pulls from `@suzumiyaaoba/mdxr`(/components),
 * extracted with a
 * regex over its source. `names`/`vProps` are `"all"` for namespace, default,
 * bare, or dynamic imports and for uninspectable importers — the fallback
 * keeps semantics correct at the cost of emitting every catalog re-export.
 */
export const scanMdxrImports = async (
  importer: string
): Promise<MdxrImports> => {
  let source: string;
  try {
    source = await readFile(importer, "utf-8");
  } catch {
    return { names: "all", vProps: "all" };
  }
  const names = new Set<string>();
  const vAliases: string[] = [];
  // `\s*` not `\s+`: `import{v}from"@suzumiyaaoba/mdxr"` is legal and must
  // still register.
  // `(?!\s*type\b)` puts the whitespace inside the lookahead — a `\s*` outside
  // would backtrack to zero and let `import type` slip through as a runtime
  // import (over-shipping the whole surface). The clause pattern alternates
  // comments with plain chars so a `;`, `'`, or `"` inside a comment doesn't
  // truncate the clause and hide the whole import.
  const fromRe =
    /(?:import|export)\s*(?!\s*type\b)(?<clause>(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*|[^;"'])*?)\s*from\s*["']@suzumiyaaoba\/mdxr(?:\/components)?["']/gu;
  let stripped = source;
  // `export { v } from "@suzumiyaaoba/mdxr"` hands the namespace to consumers —
  // every
  // property is reachable, so the per-prop access scan can't apply.
  let vEscapes = false;
  for (const m of source.matchAll(fromRe)) {
    const clause = m.groups?.clause ?? "";
    stripped = stripped.replace(m[0], "");
    if (!clause.startsWith("{")) {
      return { names: "all", vProps: "all" };
    }
    const found = vAliases.length;
    parseClause(clause, names, vAliases);
    vEscapes ||= m[0].startsWith("export") && vAliases.length > found;
  }
  // Type-only imports don't run, but a leftover `import type { v }` would
  // still trip the `\bv\b` leftover scan and force-ship all of valibot.
  stripped = stripped.replaceAll(
    /(?:import|export)\s+type\s[^;]*?(?:;|$)/gmu,
    ""
  );
  // Bare/dynamic imports escape analysis entirely. The separator allows
  // comments — `import /* x */ ("@suzumiyaaoba/mdxr")` is legal and must
  // still count.
  const sep = String.raw`(?:\s|/\*[\s\S]*?\*/|//[^\n]*)*`;
  if (
    new RegExp(
      `import${sep}["']@suzumiyaaoba/mdxr(?:/components)?["']`,
      "u"
    ).test(source) ||
    new RegExp(
      `import${sep}\\(${sep}["']@suzumiyaaoba/mdxr(?:/components)?["']`,
      "u"
    ).test(source)
  ) {
    return { names: "all", vProps: "all" };
  }
  const vProps = mergeVProps(stripped, vAliases, vEscapes);
  return {
    names,
    vProps: vAliases.length === 0 ? null : (vProps ?? new Set()),
  };
};

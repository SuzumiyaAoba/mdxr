/**
 * Export-surface scanning for the hydration bundle: which leaf module
 * provides each public name, and which names each public specifier
 * (`@suzumiyaaoba/mdxr`, `…/components`) actually exports. Derived by
 * scanning the
 * leaf modules under `src/ui/` + `src/components/ui/` rather than parsing
 * barrels: any export form (`export *`, `export const`, `export {X}` lists,
 * re-export chains like ask→ask-question) resolves correctly, and new leaf
 * files self-register.
 */

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { srcDir } from "../paths.js";
import { shadcnModules } from "../ui/shadcn.js";

let exportIndexCache: ExportIndex | undefined;

const DECLARE_RE = /export\s+(?:const|function|class)\s+(?<name>\w+)/gu;
const REEXPORT_RE =
  /export\s+(?!type\b)\{(?<names>[^}]*)\}\s*from\s*"(?<mod>\.[^"]+)"/gu;
/** `export * as name from "x"` — the exported name is `name`. */
const STAR_AS_RE = /export\s+\*\s+as\s+(?<name>\w+)\s+from\s*"[^"]+"/gu;
/** `export * from "./x.js"` — the surface walk follows relative targets. */
const STAR_RE = /export\s+\*\s+from\s*"(?<mod>\.[^"]+)"/gu;
/** `export { A, B as C }` with no `from` — local re-export list (shadcn style). */
const LOCAL_EXPORT_RE = /export\s+(?!type\b)\{(?<names>[^}]*)\}(?!\s*from\b)/gu;

/**
 * `{ A, type B, C as D }` clause → runtime names importers see (`A`, `D`).
 * `type`-marked parts are erased at runtime — emitting `export { B } from "m"`
 * for one would explode the whole bundle with "no matching export".
 */
const exportedNames = (names: string | undefined): string[] =>
  (names ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "" && !part.startsWith("type "))
    .map(
      (part) =>
        part
          .split(/\s+as\s+/u)
          .pop()
          ?.trim() ?? ""
    )
    .filter((name) => name !== "");

/** `[exportName, target]` pairs a leaf module re-exports (`export {X as Y} from "./z"`). */
const reexportTargets = (
  source: string,
  dir: string
): (readonly [string, string])[] => {
  const pairs: (readonly [string, string])[] = [];
  for (const m of source.matchAll(REEXPORT_RE)) {
    const mod = path.join(dir, m.groups?.mod ?? "");
    for (const name of exportedNames(m.groups?.names)) {
      pairs.push([name, mod]);
    }
  }
  return pairs;
};

/** A `./x.js` specifier in our sources maps to `./x.ts`/`.tsx` on disk. */
const sourceFile = (spec: string, dir: string): string | undefined => {
  const stem = path.resolve(dir, spec).replace(/\.js$/u, "");
  for (const ext of [".ts", ".tsx", ".js"]) {
    const p = `${stem}${ext}`;
    if (existsSync(p)) {
      return p;
    }
  }
  return undefined;
};

/** Every runtime-exported name in `source` lands in `out`. */
const collectNames = (source: string, out: Set<string>): void => {
  for (const m of source.matchAll(DECLARE_RE)) {
    const name = m.groups?.name;
    if (name !== undefined) {
      out.add(name);
    }
  }
  for (const m of source.matchAll(STAR_AS_RE)) {
    const name = m.groups?.name;
    if (name !== undefined) {
      out.add(name);
    }
  }
  for (const re of [REEXPORT_RE, LOCAL_EXPORT_RE]) {
    for (const m of source.matchAll(re)) {
      for (const name of exportedNames(m.groups?.names)) {
        out.add(name);
      }
    }
  }
};

/**
 * Every name `entry` re-exports, chasing `export *` targets — the surface the
 * real package shows importers. Type-only exports never match the regexes
 * (`export type`, `type X` parts), so the set holds runtime names only.
 */
const collectSurface = async (entry: string): Promise<Set<string>> => {
  const out = new Set<string>();
  const seen = new Set<string>();
  const walk = async (file: string): Promise<void> => {
    if (seen.has(file)) {
      return;
    }
    seen.add(file);
    let source: string;
    try {
      source = await readFile(file, "utf-8");
    } catch {
      return;
    }
    collectNames(source, out);
    const dir = path.dirname(file);
    const starTargets: string[] = [];
    for (const m of source.matchAll(STAR_RE)) {
      const mod = m.groups?.mod;
      if (mod === undefined) {
        continue;
      }
      const target = sourceFile(mod, dir);
      if (target !== undefined) {
        starTargets.push(target);
      }
    }
    await Promise.all(starTargets.map(walk));
  };
  await walk(entry);
  return out;
};

export interface ExportIndex {
  /** export name → leaf module, for every name a public entry can produce. */
  map: Map<string, string>;
  /**
   * Names each public specifier actually exports — the virtual module must
   * not resolve beyond this, or the client would see a real value where SSR's
   * import failed or bound `undefined` (e.g. `mountDocument`, leaf internals
   * like `fileIcon` under the root entry, or `v` under `/components`).
   */
  surfaces: { components: Set<string>; mdxr: Set<string> };
}

/**
 * All `name → module` pairs a leaf file claims — declarations plus every
 * re-export form. Returned rather than written into a shared map: callers
 * merge in sorted filename order, so a duplicated export name resolves
 * deterministically instead of racing whichever `readFile` finished last.
 */
const scanLeaf = async (
  filePath: string
): Promise<(readonly [string, string])[]> => {
  const source = await readFile(filePath, "utf-8");
  const dir = path.dirname(filePath);
  const pairs: (readonly [string, string])[] = [];
  for (const m of source.matchAll(DECLARE_RE)) {
    const name = m.groups?.name;
    if (name !== undefined) {
      pairs.push([name, filePath]);
    }
  }
  for (const [name, mod] of reexportTargets(source, dir)) {
    pairs.push([name, mod]);
  }
  for (const m of source.matchAll(LOCAL_EXPORT_RE)) {
    for (const name of exportedNames(m.groups?.names)) {
      pairs.push([name, filePath]);
    }
  }
  for (const m of source.matchAll(STAR_AS_RE)) {
    const name = m.groups?.name;
    if (name !== undefined) {
      pairs.push([name, filePath]);
    }
  }
  return pairs;
};

/**
 * export name → module specifier for every name the catalog can produce,
 * plus the real export surface of each public specifier.
 */
// Exported for tests — the surface contract is what keeps SSR and the
// hydration bundle in agreement; it deserves direct assertions.
export const exportIndex = async (): Promise<ExportIndex> => {
  if (exportIndexCache !== undefined) {
    return exportIndexCache;
  }
  const map = new Map<string, string>([
    ["DocContext", path.join(srcDir, "doc-context.js")],
  ]);
  const leafDirs = [
    path.join(srcDir, "ui"),
    path.join(srcDir, "components/ui"),
  ];
  const scanned = await Promise.all(
    leafDirs.map(async (dir) => {
      const entries = await readdir(dir);
      const files = entries
        .filter((f) => /\.tsx?$/u.test(f) && f !== "index.ts")
        .toSorted();
      return await Promise.all(
        files.map(async (f) => await scanLeaf(path.join(dir, f)))
      );
    })
  );
  // Serial merge in sorted order — the parallel scans above must not make
  // a name collision's winner depend on I/O timing.
  for (const pairs of scanned.flat()) {
    for (const [name, mod] of pairs) {
      map.set(name, mod);
    }
  }
  for (const [name, mod] of Object.entries(shadcnModules)) {
    map.set(name, path.join(srcDir, "ui", mod));
  }
  const index: ExportIndex = {
    map,
    surfaces: {
      components: await collectSurface(path.join(srcDir, "components.ts")),
      mdxr: await collectSurface(path.join(srcDir, "index.ts")),
    },
  };
  exportIndexCache = index;
  return index;
};

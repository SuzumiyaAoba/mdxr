/**
 * The virtual `mdxr`/`mdxr/components` module used inside hydration bundles.
 * A fresh module is generated per importer containing only the re-exports
 * that importer requests: esbuild eagerly resolves every
 * `export { x } from "m"` target, and the leaf modules' top-level
 * `defineComponent(...)` calls count as side effects — so a module exporting
 * the whole catalog would drag the whole catalog into the bundle.
 */

import path from "node:path";

import type { Plugin } from "esbuild";
import * as valibot from "valibot";

import { srcDir } from "../paths.js";
import type { ExportIndex } from "./export-index.js";
import { scanMdxrImports } from "./import-scan.js";
import type { MdxrImports } from "./import-scan.js";

/**
 * Names that live outside the leaf map: `builtinComponents` is defined in the
 * catalog barrel itself (pulling it is intentional — the whole catalog is the
 * value) and `defineConfig` is part of the `mdxr` API surface. They resolve
 * only when a module actually imports them.
 */
export const EXTRA_MODULES: Record<string, string> = {
  builtinComponents: path.join(srcDir, "ui/index.js"),
  defineConfig: path.join(srcDir, "config.js"),
  mountDocument: path.join(srcDir, "hydrate-runtime.js"),
};

/**
 * The virtual module's `v` export. `export * as v` would materialize the
 * entire valibot namespace — a plain object built from named imports ships
 * only the schemas actually written. Unknown `v.x` accesses stay absent,
 * matching `undefined` semantics. The `surface` gate keeps `mdxr/components`
 * honest: that specifier has no `v` export, so shipping one would diverge
 * from SSR.
 */
const vExportLines = (imports: MdxrImports, surface: Set<string>): string[] => {
  if (!surface.has("v") || imports.vProps === null) {
    return [];
  }
  if (imports.vProps === "all" || imports.names === "all") {
    return ['export * as v from "valibot";'];
  }
  const props: string[] = [];
  for (const p of imports.vProps) {
    if (p in valibot) {
      props.push(p);
    }
  }
  return [
    props.length > 0
      ? `import { ${props.join(", ")} } from "valibot";\nexport const v = { ${props.join(", ")} };`
      : "export const v = {};",
  ];
};

/**
 * Virtual stand-in for `mdxr` / `mdxr/components` inside the bundle.
 */
// Exported for tests — pure codegen, so the emitted export list is easy to
// assert without running esbuild.
export const runtimeModuleContents = (
  map: Map<string, string>,
  imports: MdxrImports,
  surface: Set<string>
): string => {
  const lines = [
    `export { defineComponent, textOf } from ${JSON.stringify(path.join(srcDir, "define.js"))};`,
    ...vExportLines(imports, surface),
  ];
  // "all" (namespace/default/dynamic imports) exports exactly the specifier's
  // real surface — leaf internals and EXTRA names like `mountDocument` stay
  // hidden, matching what the actual package would hand SSR. Named imports
  // beyond the surface are skipped: SSR's link error is then mirrored by an
  // esbuild "no matching export" failure instead of a silent divergence.
  const wanted = imports.names === "all" ? [...surface] : [...imports.names];
  const byModule = new Map<string, string[]>();
  for (const name of wanted) {
    if (!surface.has(name)) {
      continue;
    }
    const mod = map.get(name) ?? EXTRA_MODULES[name];
    if (mod === undefined) {
      continue;
    }
    const list = byModule.get(mod) ?? [];
    list.push(name);
    byModule.set(mod, list);
  }
  for (const [mod, mods] of byModule) {
    lines.push(`export { ${mods.join(", ")} } from ${JSON.stringify(mod)};`);
  }
  return lines.join("\n");
};

/* oxlint-disable require-unicode-regexp -- esbuild onResolve/onLoad filters forbid `u` */
export const runtimeModule = (index: ExportIndex): Plugin => ({
  name: "mdxr:runtime",
  setup(b) {
    const importers = new Map<
      string,
      { importer: string; surface: Set<string> }
    >();
    let seq = 0;
    b.onResolve({ filter: /^mdxr(?:\/components)?$/ }, (args) => {
      const virtual = `mdxr:runtime:${seq}`;
      seq += 1;
      importers.set(virtual, {
        importer: args.importer,
        // Each specifier gets its own real surface — `mdxr` (config API) and
        // `mdxr/components` (the catalog) are deliberately different sets.
        surface:
          args.path === "mdxr"
            ? index.surfaces.mdxr
            : index.surfaces.components,
      });
      return { namespace: "mdxr-runtime", path: virtual };
    });
    b.onLoad(
      { filter: /^mdxr:runtime:/, namespace: "mdxr-runtime" },
      async (args) => {
        const v = importers.get(args.path);
        return {
          contents: runtimeModuleContents(
            index.map,
            await scanMdxrImports(v?.importer ?? ""),
            v?.surface ?? index.surfaces.components
          ),
          loader: "js",
          resolveDir: srcDir,
        };
      }
    );
  },
});
/* oxlint-enable require-unicode-regexp */

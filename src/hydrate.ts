/**
 * Hydration bundle assembly: generates the inlined client script that
 * rebuilds the exact vnode tree SSR produced and `hydrateRoot`s it onto
 * `<main id="mdxr-root">`. Implementation details live in `src/hydrate/`:
 * `export-index` (export surface scanning), `import-scan` (user-module
 * import analysis), `runtime-module` (virtual `mdxr` module codegen), and
 * `plugins` (esbuild plugins for shared packages, the doc module, icons).
 */

import { build } from "esbuild";

import { exportIndex } from "./hydrate/export-index.js";
import { docModule, iconSets, pinShared } from "./hydrate/plugins.js";
import { EXTRA_MODULES, runtimeModule } from "./hydrate/runtime-module.js";
import { pkgRoot } from "./paths.js";
import { builtinComponents } from "./ui/index.js";

export { exportIndex } from "./hydrate/export-index.js";
export { runtimeModuleContents } from "./hydrate/runtime-module.js";

export interface HydrateSpec {
  /** Compiled MDX module source (`program` format; default export = content). */
  code: string;
  /** Resolved entry of the user's components module, when configured. */
  componentsPath?: string;
  /** `fileLink(rel, line)` results recorded during SSR (`rel\0line` → url). */
  fileLinks: Record<string, string>;
  /** PlanHeader props, present iff the document header was rendered. */
  header?: Record<string, string | undefined>;
  /** SSR render timestamp (ISO) — replayed into `DocContext.now`. */
  now?: string;
  /** Catalog keys the document referenced — only these get imported. */
  usedComponents: string[];
  /** Iconify names (`prefix:name`) resolved during SSR. */
  usedIcons: string[];
}

/**
 * Build the inlined client script: it rebuilds the exact vnode tree SSR
 * produced — `DocContext.Provider` wrapping the Plan header + the compiled
 * MDX module — and `hydrateRoot`s it onto `<main id="mdxr-root">`.
 * `fileLink` is replayed from the recorded SSR answers, so components see
 * identical data without filesystem access.
 */
export const buildHydrateScript = async (
  spec: HydrateSpec
): Promise<string> => {
  const index = await exportIndex();
  const { map } = index;
  const imports: string[] = [];
  const entries: string[] = [];
  let seq = 0;
  // One aliased named import per leaf module keeps the generated code simple
  // and collision-free; esbuild dedupes repeated module loads.
  const bind = (exported: string): string => {
    const mod = map.get(exported) ?? EXTRA_MODULES[exported];
    if (mod === undefined) {
      throw new Error(
        `hydration: no module provides catalog export "${exported}"`
      );
    }
    const local = `__mdxr_c${seq}`;
    seq += 1;
    imports.push(
      `import { ${exported} as ${local} } from ${JSON.stringify(mod)};`
    );
    return local;
  };

  const mountDocument = bind("mountDocument");
  // PlanHeader is only needed when a frontmatter header was rendered —
  // binding it unconditionally would drag Meta/Due/StatusBadge into every
  // bundle.
  const planHeader =
    spec.header === undefined ? "undefined" : bind("PlanHeader");

  for (const name of spec.usedComponents) {
    // User components merge via their namespace below; the `hasOwn` check must
    // be own-property only — `in` alone treats `constructor` etc. as catalog
    // names. `pre` (the markdown override) is exported as `Pre`.
    if (!Object.hasOwn(builtinComponents, name)) {
      continue;
    }
    const exported = name === "pre" ? "Pre" : name;
    entries.push(`${JSON.stringify(name)}: ${bind(exported)}`);
  }

  const userImport =
    spec.componentsPath === undefined
      ? ""
      : `import * as __mdxrUser from ${JSON.stringify(spec.componentsPath)};`;

  // Mount/merge details live in hydrate-runtime (a real, type-checked module
  // bundled by esbuild); the generated entry only binds names and data.
  const entry = `${imports.join("\n")}
${userImport}
import __mdxrDoc from "mdxr:doc";
${mountDocument}({
  components: { ${entries.join(", ")} },
  doc: __mdxrDoc,
  fileLinks: ${JSON.stringify(spec.fileLinks)},
  headerProps: ${JSON.stringify(spec.header)},
  now: ${JSON.stringify(spec.now)},
  planHeader: ${planHeader},
  userModule: ${spec.componentsPath === undefined ? "undefined" : "__mdxrUser"},
});
`;

  const result = await build({
    absWorkingDir: pkgRoot,
    bundle: true,
    define: { "process.env.NODE_ENV": '"production"' },
    format: "iife",
    jsx: "automatic",
    jsxImportSource: "react",
    logLevel: "silent",
    metafile: true,
    minify: true,
    platform: "browser",
    plugins: [
      pinShared,
      docModule(spec.code),
      runtimeModule(index),
      iconSets(spec.usedIcons),
    ],
    stdin: {
      contents: entry,
      loader: "js",
      resolveDir: pkgRoot,
      sourcefile: "mdxr-hydrate.js",
    },
    target: "es2022",
    write: false,
  });
  // `MDXR_BUNDLE_METAFILE=<path>` dumps the esbuild metafile for size work.
  if (process.env.MDXR_BUNDLE_METAFILE !== undefined) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(
      process.env.MDXR_BUNDLE_METAFILE,
      JSON.stringify(result.metafile)
    );
    await writeFile(`${process.env.MDXR_BUNDLE_METAFILE}.entry.js`, entry);
  }
  // htmlDocument applies `inlineScript` escaping at embed time — return the
  // raw bundle here.
  return result.outputFiles[0]?.text ?? "";
};

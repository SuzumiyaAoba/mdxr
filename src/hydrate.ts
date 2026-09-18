import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { icons as lucide } from "@iconify-json/lucide";
import { icons as vscodeIcons } from "@iconify-json/vscode-icons";
import { build } from "esbuild";
import type { Plugin } from "esbuild";
import * as valibot from "valibot";

import { SHARED_PACKAGES } from "./load-user-module.js";
import { pkgRoot } from "./paths.js";
import { builtinComponents } from "./ui/index.js";
import { shadcnModules } from "./ui/shadcn.js";

/**
 * The hydration bundle is always built from `src/` — the TypeScript sources
 * ship with the package, so packed installs and local dev produce identical
 * bundles. Building from sources (rather than the packed `dist/` chunks) is
 * also what makes tree-shaking effective: every used component is imported
 * from its leaf module, and no barrel file is ever loaded.
 */
const SRC = path.join(pkgRoot, "src");

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

interface ExportIndex {
  /** export name → leaf module, for every name a public entry can produce. */
  map: Map<string, string>;
  /**
   * Names each public specifier actually exports — the virtual module must
   * not resolve beyond this, or the client would see a real value where SSR's
   * import failed or bound `undefined` (e.g. `mountDocument`, leaf internals
   * like `fileIcon` under `mdxr`, or `v` under `mdxr/components`).
   */
  surfaces: { components: Set<string>; mdxr: Set<string> };
}

/** All names a leaf file exports — declarations plus every re-export form. */
const scanLeaf = async (
  filePath: string,
  map: Map<string, string>
): Promise<void> => {
  const source = await readFile(filePath, "utf-8");
  const dir = path.dirname(filePath);
  for (const m of source.matchAll(DECLARE_RE)) {
    const name = m.groups?.name;
    if (name !== undefined) {
      map.set(name, filePath);
    }
  }
  for (const [name, mod] of reexportTargets(source, dir)) {
    map.set(name, mod);
  }
  for (const m of source.matchAll(LOCAL_EXPORT_RE)) {
    for (const name of exportedNames(m.groups?.names)) {
      map.set(name, filePath);
    }
  }
  for (const m of source.matchAll(STAR_AS_RE)) {
    const name = m.groups?.name;
    if (name !== undefined) {
      map.set(name, filePath);
    }
  }
};

/**
 * export name → module specifier for every name the catalog can produce,
 * plus the real export surface of each public specifier. Derived by scanning
 * the leaf modules under `src/ui/` + `src/components/ui/` rather than parsing
 * barrels: any export form (`export *`, `export const`, `export {X}` lists,
 * re-export chains like ask→ask-question) resolves correctly, and new leaf
 * files self-register.
 */
// Exported for tests — the surface contract is what keeps SSR and the
// hydration bundle in agreement; it deserves direct assertions.
export const exportIndex = async (): Promise<ExportIndex> => {
  if (exportIndexCache !== undefined) {
    return exportIndexCache;
  }
  const map = new Map<string, string>([
    ["DocContext", path.join(SRC, "doc-context.js")],
  ]);
  const leafDirs = [path.join(SRC, "ui"), path.join(SRC, "components/ui")];
  await Promise.all(
    leafDirs.map(async (dir) => {
      const entries = await readdir(dir);
      const files = entries.filter(
        (f) => /\.tsx?$/u.test(f) && f !== "index.ts"
      );
      await Promise.all(
        files.map(async (f) => {
          await scanLeaf(path.join(dir, f), map);
        })
      );
    })
  );
  for (const [name, mod] of Object.entries(shadcnModules)) {
    map.set(name, path.join(SRC, "ui", mod));
  }
  const index: ExportIndex = {
    map,
    surfaces: {
      components: await collectSurface(path.join(SRC, "components.ts")),
      mdxr: await collectSurface(path.join(SRC, "index.ts")),
    },
  };
  exportIndexCache = index;
  return index;
};

/**
 * Everything the document bundle shares with mdxr itself — React above all
 * (a second copy would break hooks/context) — is resolved from this package's
 * own node_modules regardless of where the user's components live.
 * (esbuild serializes onResolve filters to Go's RE2: no `u` flag.)
 */
/* oxlint-disable require-unicode-regexp -- esbuild onResolve filters forbid `u` */
const SHARED_RE = new RegExp(`^(?:${SHARED_PACKAGES.join("|")})(?:/.*)?$`);

const pinShared: Plugin = {
  name: "mdxr:pin-shared",
  setup(b) {
    b.onResolve({ filter: SHARED_RE }, async (args) => {
      // b.resolve re-enters this plugin — pluginData marks the inner call so
      // the recursion stops after exactly one delegation.
      if (args.pluginData === pinShared) {
        return null;
      }
      const r = await b.resolve(args.path, {
        kind: args.kind,
        pluginData: pinShared,
        resolveDir: pkgRoot,
      });
      return r.errors.length === 0 ? { path: r.path } : null;
    });
  },
};
/* oxlint-enable require-unicode-regexp */

/** The compiled MDX module enters the bundle as a virtual `mdxr:doc` import. */
/* oxlint-disable require-unicode-regexp -- esbuild onResolve/onLoad filters forbid `u` */
const docModule = (code: string): Plugin => ({
  name: "mdxr:doc",
  setup(b) {
    b.onResolve({ filter: /^mdxr:doc$/ }, () => ({
      namespace: "mdxr-doc",
      path: "mdxr:doc",
    }));
    b.onLoad({ filter: /^mdxr:doc$/, namespace: "mdxr-doc" }, () => ({
      contents: code,
      loader: "js",
      resolveDir: SRC,
    }));
  },
});
/* oxlint-enable require-unicode-regexp */

/**
 * Names that live outside the leaf map: `builtinComponents` is defined in the
 * catalog barrel itself (pulling it is intentional — the whole catalog is the
 * value) and `defineConfig` is part of the `mdxr` API surface. They resolve
 * only when a module actually imports them.
 */
const EXTRA_MODULES: Record<string, string> = {
  builtinComponents: path.join(SRC, "ui/index.js"),
  defineConfig: path.join(SRC, "config.js"),
  mountDocument: path.join(SRC, "hydrate-runtime.js"),
};

interface MdxrImports {
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

/** Parse `{ a, b as c, type T }` import specifiers into names + `v` aliases. */
const parseClause = (
  clause: string,
  names: Set<string>,
  vAliases: string[]
): void => {
  for (const part of clause.slice(1, -1).split(",")) {
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

/**
 * Which names `importer` pulls from `mdxr`/`mdxr/components`, extracted with a
 * regex over its source. `names`/`vProps` are `"all"` for namespace, default,
 * bare, or dynamic imports and for uninspectable importers — the fallback
 * keeps semantics correct at the cost of emitting every catalog re-export.
 */
const scanMdxrImports = async (importer: string): Promise<MdxrImports> => {
  let source: string;
  try {
    source = await readFile(importer, "utf-8");
  } catch {
    return { names: "all", vProps: "all" };
  }
  const names = new Set<string>();
  const vAliases: string[] = [];
  // `\s*` not `\s+`: `import{v}from"mdxr"` is legal and must still register.
  const fromRe =
    /(?:import|export)\s*(?!type\b)(?<clause>[^;"']*?)\s*from\s*["']mdxr(?:\/components)?["']/gu;
  let stripped = source;
  for (const m of source.matchAll(fromRe)) {
    const clause = m.groups?.clause ?? "";
    stripped = stripped.replace(m[0], "");
    if (!clause.startsWith("{")) {
      return { names: "all", vProps: "all" };
    }
    parseClause(clause, names, vAliases);
  }
  // Type-only imports don't run, but a leftover `import type { v }` would
  // still trip the `\bv\b` leftover scan and force-ship all of valibot.
  stripped = stripped.replaceAll(
    /(?:import|export)\s+type\s[^;]*?(?:;|$)/gmu,
    ""
  );
  if (
    /import\s+["']mdxr(?:\/components)?["']/u.test(source) ||
    /import\s*\(\s*["']mdxr(?:\/components)?["']/u.test(source)
  ) {
    return { names: "all", vProps: "all" };
  }
  let vProps: Set<string> | "all" | null = null;
  for (const alias of vAliases) {
    const props = scanVProps(stripped, alias);
    if (props === "all") {
      vProps = "all";
      break;
    }
    vProps = vProps === null ? props : new Set([...vProps, ...props]);
  }
  return {
    names,
    vProps: vAliases.length === 0 ? null : (vProps ?? new Set()),
  };
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
 * Virtual stand-in for `mdxr` / `mdxr/components` inside the bundle. A fresh
 * module is generated per importer containing only the re-exports that
 * importer requests: esbuild eagerly resolves every `export { x } from "m"`
 * target, and the leaf modules' top-level `defineComponent(...)` calls count
 * as side effects — so a module exporting the whole catalog would drag the
 * whole catalog into the bundle.
 */
// Exported for tests — pure codegen, so the emitted export list is easy to
// assert without running esbuild.
export const runtimeModuleContents = (
  map: Map<string, string>,
  imports: MdxrImports,
  surface: Set<string>
): string => {
  const lines = [
    `export { defineComponent, textOf } from ${JSON.stringify(path.join(SRC, "define.js"))};`,
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
const runtimeModule = (index: ExportIndex): Plugin => ({
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
          resolveDir: SRC,
        };
      }
    );
  },
});
/* oxlint-enable require-unicode-regexp */

const ICON_SETS: Record<string, typeof lucide> = {
  "@iconify-json/lucide": lucide,
  "@iconify-json/vscode-icons": vscodeIcons,
};

/**
 * The bundled icon sets are several MB of JSON; a document only ever renders
 * the icons recorded during SSR. Redirecting each `@iconify-json/*` import to
 * a partial collection (used names only, alias parents included) keeps
 * `addCollection` calls working while shipping kilobytes, not megabytes.
 */
/* oxlint-disable require-unicode-regexp -- esbuild onResolve/onLoad filters forbid `u` */
const iconSets = (usedIcons: readonly string[]): Plugin => ({
  name: "mdxr:icons",
  setup(b) {
    b.onResolve({ filter: /^@iconify-json\// }, (args) => ({
      namespace: "mdxr-icons",
      path: args.path,
    }));
    b.onLoad(
      { filter: /^@iconify-json\//, namespace: "mdxr-icons" },
      (args) => {
        const set = ICON_SETS[args.path];
        if (set === undefined) {
          return { contents: "export const icons = {};", loader: "js" };
        }
        const icons: Record<string, unknown> = {};
        const aliases: Record<string, unknown> = {};
        for (const full of usedIcons) {
          const [prefix, name] = full.split(":");
          if (prefix !== set.prefix || name === undefined) {
            continue;
          }
          // hasOwn: names like "toString" must not pull prototype members —
          // a function would serialize as `{}` and ship a phantom icon.
          if (Object.hasOwn(set.icons, name)) {
            icons[name] = set.icons[name];
          }
          const alias = Object.hasOwn(set.aliases ?? {}, name)
            ? set.aliases?.[name]
            : undefined;
          if (alias !== undefined) {
            aliases[name] = alias;
            if (Object.hasOwn(set.icons, alias.parent)) {
              icons[alias.parent] = set.icons[alias.parent];
            }
          }
        }
        return {
          contents: `export const icons = ${JSON.stringify({ ...set, aliases, icons })};`,
          loader: "js",
        };
      }
    );
  },
});
/* oxlint-enable require-unicode-regexp */

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

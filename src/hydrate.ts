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

let moduleMapCache: Map<string, string> | undefined;

const DECLARE_RE = /export\s+(?:const|function|class)\s+(?<name>\w+)/gu;
const REEXPORT_RE =
  /export\s+(?!type\b)\{(?<names>[^}]*)\}\s*from\s*"(?<mod>\.[^"]+)"/gu;

/** `[exportName, target]` pairs a leaf module re-exports (`export {X as Y} from "./z"`). */
const reexportTargets = (
  source: string,
  uiDir: string
): (readonly [string, string])[] => {
  const pairs: (readonly [string, string])[] = [];
  for (const m of source.matchAll(REEXPORT_RE)) {
    const mod = path.join(uiDir, m.groups?.mod ?? "");
    for (const part of (m.groups?.names ?? "").split(",")) {
      const name = part
        .trim()
        .replace(/^type\s+/u, "")
        .split(/\s+as\s+/u)
        .pop()
        ?.trim();
      if (name !== undefined && name !== "") {
        pairs.push([name, mod]);
      }
    }
  }
  return pairs;
};

/**
 * export name → module specifier for every name the catalog can produce.
 * Derived by scanning the leaf modules under `src/ui/` rather than parsing
 * `index.ts`: any export form in the barrel (`export *`, `export const`,
 * re-export chains like ask→ask-question) resolves correctly, and new leaf
 * files self-register. `export {X} from "./y"` inside a leaf maps the name
 * straight to the target module; type-only exports are skipped.
 */
const exportModuleMap = async (): Promise<Map<string, string>> => {
  if (moduleMapCache !== undefined) {
    return moduleMapCache;
  }
  const uiDir = path.join(SRC, "ui");
  const entries = await readdir(uiDir);
  const files = entries.filter((f) => /\.tsx?$/u.test(f) && f !== "index.ts");
  const map = new Map<string, string>([
    ["DocContext", path.join(SRC, "doc-context.js")],
  ]);
  await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(uiDir, file);
      const source = await readFile(filePath, "utf-8");
      for (const m of source.matchAll(DECLARE_RE)) {
        const name = m.groups?.name;
        if (name !== undefined) {
          map.set(name, filePath);
        }
      }
      for (const [name, mod] of reexportTargets(source, uiDir)) {
        map.set(name, mod);
      }
    })
  );
  for (const [name, mod] of Object.entries(shadcnModules)) {
    map.set(name, path.join(uiDir, mod));
  }
  moduleMapCache = map;
  return map;
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
  const fromRe =
    /(?:import|export)\s+(?!type\b)(?<clause>[^;"']*?)\s+from\s+["']mdxr(?:\/components)?["']/gu;
  let stripped = source;
  for (const m of source.matchAll(fromRe)) {
    const clause = m.groups?.clause ?? "";
    stripped = stripped.replace(m[0], "");
    if (!clause.startsWith("{")) {
      return { names: "all", vProps: "all" };
    }
    parseClause(clause, names, vAliases);
  }
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
 * Virtual stand-in for `mdxr` / `mdxr/components` inside the bundle. A fresh
 * module is generated per importer containing only the re-exports that
 * importer requests: esbuild eagerly resolves every `export { x } from "m"`
 * target, and the leaf modules' top-level `defineComponent(...)` calls count
 * as side effects — so a module exporting the whole catalog would drag the
 * whole catalog into the bundle.
 */
const runtimeModuleContents = (
  map: Map<string, string>,
  imports: MdxrImports
): string => {
  const lines = [
    `export { defineComponent, textOf } from ${JSON.stringify(path.join(SRC, "define.js"))};`,
  ];
  // `export * as v` would materialize the entire valibot namespace — a plain
  // object built from named imports ships only the schemas actually written.
  // Unknown `v.x` accesses simply stay absent, matching `undefined` semantics.
  if (imports.vProps === "all" || imports.names === "all") {
    lines.push('export * as v from "valibot";');
  } else if (imports.vProps !== null) {
    const props = [...imports.vProps].filter((p) => p in valibot);
    lines.push(
      props.length > 0
        ? `import { ${props.join(", ")} } from "valibot";\nexport const v = { ${props.join(", ")} };`
        : "export const v = {};"
    );
  }
  const wanted = imports.names === "all" ? map.keys() : imports.names;
  const byModule = new Map<string, string[]>();
  for (const name of wanted) {
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
const runtimeModule = (map: Map<string, string>): Plugin => ({
  name: "mdxr:runtime",
  setup(b) {
    const importers = new Map<string, string>();
    let seq = 0;
    b.onResolve({ filter: /^mdxr(?:\/components)?$/ }, (args) => {
      const virtual = `mdxr:runtime:${seq}`;
      seq += 1;
      importers.set(virtual, args.importer);
      return { namespace: "mdxr-runtime", path: virtual };
    });
    b.onLoad(
      { filter: /^mdxr:runtime:/, namespace: "mdxr-runtime" },
      async (args) => {
        const importer = importers.get(args.path) ?? "";
        return {
          contents: runtimeModuleContents(map, await scanMdxrImports(importer)),
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
          const data = set.icons[name];
          if (data !== undefined) {
            icons[name] = data;
          }
          const alias = set.aliases?.[name];
          if (alias !== undefined) {
            aliases[name] = alias;
            const parent = set.icons[alias.parent];
            if (parent !== undefined) {
              icons[alias.parent] = parent;
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
  const map = await exportModuleMap();
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
  const planHeader = bind("PlanHeader");

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
      runtimeModule(map),
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

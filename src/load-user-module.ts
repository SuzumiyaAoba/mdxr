import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";
import type { Plugin } from "esbuild";

import { isRecord } from "./guards.js";
import { cacheDir } from "./paths.js";

/**
 * Packages that must resolve to *this* package's dependencies — a second React
 * copy would break hooks/context, and `valibot` instances mix across schemas.
 * Shared with hydrate.ts's pinShared plugin (which adds no `mdxr` since the
 * runtimeModule plugin maps that specifier onto the catalog).
 */
export const SHARED_PACKAGES = ["react", "react-dom", "valibot"];

// `mdxr`/`mdxr/components` reach this same package via Node's self-reference
// (the cache file lives inside the package root).
/* oxlint-disable require-unicode-regexp -- esbuild serializes onResolve filter
   regexes to Go's RE2, which rejects the `u` flag. */
const SHARED_EXTERNALS = new RegExp(
  `^(?:${[...SHARED_PACKAGES, "mdxr"].join("|")})(?:/.*)?$`
);
/* oxlint-enable require-unicode-regexp */

const sharedExternals: Plugin = {
  name: "shared-externals",
  setup(b) {
    b.onResolve({ filter: SHARED_EXTERNALS }, (a) => ({
      external: true,
      path: a.path,
    }));
  },
};

export interface BundledModule {
  module: Record<string, unknown>;
  /** Bundled source — also used as a Tailwind scan source. */
  code: string;
}

const INDEX_FILES = ["index.tsx", "index.ts", "index.jsx", "index.js"];

/**
 * Write bundled ESM `code` into this package's cache dir (content-hashed, so
 * repeat imports are free) and import it. Living inside the package makes
 * bare imports (`react`, `valibot`, `mdxr`) resolve to *our* copies — one
 * React instance shared with renderToStaticMarkup and the hydrate bundle.
 */
export const importBundledCode = async (
  code: string,
  prefix: string
): Promise<Record<string, unknown>> => {
  await mkdir(cacheDir, { recursive: true });
  const hash = createHash("sha256").update(code).digest("hex").slice(0, 12);
  const out = path.join(cacheDir, `${prefix}-${hash}.mjs`);
  if (!existsSync(out)) {
    await writeFile(out, code);
  }
  const raw: unknown = await import(pathToFileURL(out).href);
  return isRecord(raw) ? raw : {};
};

/**
 * Resolve a user module path: directories collapse to their index file.
 * Used both when importing the module (SSR) and when bundling it for the
 * hydration script.
 */
export const resolveModuleEntry = (entryPath: string): string => {
  if (!(existsSync(entryPath) && statSync(entryPath).isDirectory())) {
    return entryPath;
  }
  for (const name of INDEX_FILES) {
    const candidate = path.join(entryPath, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return entryPath;
};

/**
 * Bundle a user-authored TS/TSX module and import it.
 * The result is written inside this package's directory so that externals
 * resolve against our node_modules (single React instance).
 */
export const loadUserModule = async (
  entryPath: string
): Promise<BundledModule> => {
  const result = await build({
    bundle: true,
    entryPoints: [entryPath],
    format: "esm",
    jsx: "automatic",
    jsxImportSource: "react",
    logLevel: "silent",
    platform: "node",
    plugins: [sharedExternals],
    target: "node20",
    write: false,
  });
  const code = result.outputFiles[0].text;
  return { code, module: await importBundledCode(code, "components") };
};

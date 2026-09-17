import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";
import type { Plugin } from "esbuild";

import { isRecord } from "./guards.js";
import { cacheDir } from "./paths.js";

// Bare specifiers that must resolve to *this* package's dependencies so the
// user's bundle shares our React instance (required for hooks) and our
// `defineComponent` registry. `mdxr`/`mdxr/components` reach this same package
// via Node's self-reference (the cache file lives inside the package root).
/* oxlint-disable require-unicode-regexp -- esbuild serializes onResolve filter
   regexes to Go's RE2, which rejects the `u` flag. */
const SHARED_EXTERNALS = /^(?:react|react-dom|valibot|mdxr)(?:\/.*)?$/;
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
 * Resolve a user module path: directories collapse to their index file.
 * Used both when importing the module (SSR) and when bundling it for the
 * hydration script.
 */
export const resolveModuleEntry = (entryPath: string): string => {
  if (
    existsSync(entryPath) &&
    !(
      entryPath.endsWith(".ts") ||
      entryPath.endsWith(".tsx") ||
      entryPath.endsWith(".js") ||
      entryPath.endsWith(".jsx")
    )
  ) {
    for (const name of INDEX_FILES) {
      const candidate = path.join(entryPath, name);
      if (existsSync(candidate)) {
        return candidate;
      }
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

  await mkdir(cacheDir, { recursive: true });
  const hash = createHash("sha256").update(code).digest("hex").slice(0, 12);
  const out = path.join(cacheDir, `${hash}.mjs`);
  await writeFile(out, code);

  const raw: unknown = await import(
    `${pathToFileURL(out).href}?t=${Date.now()}`
  );
  return { code, module: isRecord(raw) ? raw : {} };
};

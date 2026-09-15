import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";
import type { Plugin } from "esbuild";

import { isRecord } from "./guards.js";
import { cacheDir, pkgRoot } from "./paths.js";

// Bare specifiers that must resolve to *this* package's dependencies so the
// user's bundle shares our React instance (required for hooks) and our
// `defineComponent` registry.
/* oxlint-disable require-unicode-regexp -- esbuild serializes onResolve filter
   regexes to Go's RE2, which rejects the `u` flag. */
const SHARED_EXTERNALS =
  /^(?:react|react-dom|valibot|@suzumiyaaoba\/rv)(?:\/.*)?$/;

const pickEntry = (file: string, srcFallback: string): string =>
  existsSync(file) ? file : srcFallback;

/**
 * Alias shorthands for users: `rv` / `rv/components` resolve to this package
 * whether or not it is installed under the project's own node_modules.
 */
const rvAlias: Plugin = {
  name: "rv-alias",
  setup(b) {
    b.onResolve({ filter: /^rv$/ }, () => ({
      path: pickEntry(
        path.join(pkgRoot, "dist/index.mjs"),
        path.join(pkgRoot, "src/index.ts")
      ),
    }));
    b.onResolve({ filter: /^rv\/components$/ }, () => ({
      path: pickEntry(
        path.join(pkgRoot, "dist/components.mjs"),
        path.join(pkgRoot, "src/components.ts")
      ),
    }));
  },
};
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
    plugins: [rvAlias, sharedExternals],
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

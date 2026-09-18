import path from "node:path";

import { build } from "esbuild";

import { pkgRoot } from "./paths.js";

let cache: Promise<string> | undefined;

const buildClientJs = async (): Promise<string> => {
  const result = await build({
    absWorkingDir: pkgRoot,
    bundle: true,
    format: "iife",
    logLevel: "silent",
    minify: true,
    platform: "browser",
    stdin: {
      contents: 'import "./client/entry.js";',
      loader: "js",
      resolveDir: path.join(pkgRoot, "src"),
      sourcefile: "mdxr-client.js",
    },
    target: "es2022",
    write: false,
  });
  return result.outputFiles[0]?.text ?? "";
};

/**
 * Vanilla JS inlined into every document (copy/answer/save buttons, the
 * live Markdown answer sheet, the theme toggle). Bundled from
 * `src/client/entry.ts` at render time — real source, so the script is
 * type-checked and unit-testable, and bundler changes can't silently
 * break it the way `fn.toString()` serialization could. Memoized: the
 * bundle is identical for every render in a process.
 */
export const clientJs = async (): Promise<string> => {
  cache ??= buildClientJs();
  return await cache;
};

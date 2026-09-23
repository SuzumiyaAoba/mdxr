import path from "node:path";

import { build } from "esbuild";

import { pkgRoot } from "./paths.js";

let cache: Promise<string> | undefined;

const buildPageTocJs = async (): Promise<string> => {
  const result = await build({
    absWorkingDir: pkgRoot,
    bundle: true,
    define: { "process.env.NODE_ENV": '"production"' },
    format: "iife",
    jsx: "automatic",
    jsxImportSource: "react",
    logLevel: "silent",
    minify: true,
    platform: "browser",
    stdin: {
      contents:
        'import { mountPageToc } from "./page-toc-runtime.js"; mountPageToc();',
      loader: "js",
      resolveDir: path.join(pkgRoot, "src"),
      sourcefile: "mdxr-page-toc.js",
    },
    target: "es2022",
    write: false,
  });
  return result.outputFiles[0]?.text ?? "";
};

/**
 * Standalone bundle that hydrates the sidebar ToC — used only when the
 * document has no hydration bundle of its own (that one mounts the ToC with
 * the React copy it already ships). Memoized: identical for every render.
 */
export const pageTocJs = async (): Promise<string> => {
  cache ??= buildPageTocJs();
  try {
    return await cache;
  } catch (error) {
    cache = undefined;
    throw error;
  }
};

import { readFile } from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

import { LIVE_RELOAD_JS, THEME_JS } from "./assets/scripts.js";
import { inlineScript, inlineStyle } from "./html.js";
import { pkgRoot, srcDir } from "./paths.js";
import { buildCss } from "./tailwind.js";

let script: Promise<string> | undefined;

const buildLibraryJs = async (): Promise<string> => {
  const result = await build({
    absWorkingDir: pkgRoot,
    bundle: true,
    define: { "process.env.NODE_ENV": '"production"' },
    entryPoints: [path.join(srcDir, "library-app.tsx")],
    format: "iife",
    jsx: "automatic",
    jsxImportSource: "react",
    logLevel: "silent",
    minify: true,
    platform: "browser",
    target: "es2022",
    write: false,
  });
  return result.outputFiles[0]?.text ?? "";
};

export const libraryJs = async (): Promise<string> => {
  script ??= buildLibraryJs();
  try {
    return await script;
  } catch (error) {
    script = undefined;
    throw error;
  }
};

export const libraryHtml = async (): Promise<string> => {
  const sources = await Promise.all(
    ["library-app.tsx", "library-delete.tsx", "ui/tones.ts"].map(
      async (file) => ({
        content: await readFile(path.join(srcDir, file), "utf-8"),
        extension: path.extname(file).slice(1),
      })
    )
  );
  const { css } = await buildCss(
    sources,
    path.join(srcDir, "assets/library.css")
  );
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="referrer" content="no-referrer">
<title>mdxr · 文書ライブラリ / Document library</title>
<script>${inlineScript(THEME_JS)}</script>
<script>${inlineScript(LIVE_RELOAD_JS)}</script>
<style>${inlineStyle(css)}</style>
<script src="/__mdxr_library.js" defer></script>
</head>
<body>
<div id="mdxr-library-root"></div>
<noscript>文書ライブラリを使うには JavaScript を有効にしてください。Enable JavaScript to browse the document library.</noscript>
</body>
</html>`;
};

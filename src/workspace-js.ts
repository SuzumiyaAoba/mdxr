import path from "node:path";

import { build } from "esbuild";

import { pkgRoot, srcDir } from "./paths.js";

let cached: Promise<string> | undefined;

const buildWorkspaceJs = async (): Promise<string> => {
  const result = await build({
    absWorkingDir: pkgRoot,
    bundle: true,
    define: { "process.env.NODE_ENV": '"production"' },
    entryPoints: [path.join(srcDir, "workspace-app.tsx")],
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

/** Browser-only React workspace used while serving a file. */
export const workspaceJs = async (): Promise<string> => {
  cached ??= buildWorkspaceJs();
  try {
    return await cached;
  } catch (error) {
    cached = undefined;
    throw error;
  }
};

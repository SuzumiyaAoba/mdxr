import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import { build } from "esbuild";
import type { Plugin } from "vite";
import { mergeConfig } from "vite";

import { importBundledCode } from "../src/load-user-module.js";
import { mdxrComponentDocuments } from "./component-documents.js";

const VIRTUAL_ID = "virtual:mdxr-documents";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;
const ASCII_ID = "virtual:mdxr-ascii";
const ASCII_RESOLVED_ID = `\0${ASCII_ID}`;

const rootDir = process.cwd();
const docsDir = path.join(rootDir, "examples");
const srcDir = path.join(rootDir, "src");
const rendererEntry = path.join(srcDir, "render.ts");
const asciiEntry = path.join(srcDir, "ascii", "index.ts");

const listFiles = async (dir: string): Promise<string[]> => {
  try {
    const entries = await readdir(dir, {
      recursive: true,
      withFileTypes: true,
    });
    return entries
      .filter((e) => e.isFile())
      .map((e) => path.join(e.parentPath, e.name));
  } catch {
    return [];
  }
};

type RenderFile = (mdxPath: string) => Promise<string>;
type RenderAscii = (mdxPath: string) => Promise<string>;

/**
 * Bundle the real renderer (`src/render.ts`) on every call and import it.
 * Re-bundling keeps document previews in sync with edits to src/**; the
 * content-hashed cache write + import is shared with `loadUserModule`.
 */
const loadRenderer = async (): Promise<RenderFile> => {
  const result = await build({
    bundle: true,
    entryPoints: [rendererEntry],
    format: "esm",
    jsx: "automatic",
    jsxImportSource: "react",
    logLevel: "silent",
    packages: "external",
    platform: "node",
    target: "node20",
    write: false,
  });
  const mod = await importBundledCode(
    result.outputFiles[0]?.text ?? "",
    "storybook"
  );
  const { renderFile } = mod;
  if (typeof renderFile !== "function") {
    throw new TypeError("mdxr: renderer module did not export renderFile");
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return renderFile as RenderFile;
};

/** Bundle `src/ascii/index.ts` the same way and import `mdxToAscii`. */
const loadAscii = async (): Promise<RenderAscii> => {
  const result = await build({
    bundle: true,
    entryPoints: [asciiEntry],
    format: "esm",
    jsx: "automatic",
    jsxImportSource: "react",
    logLevel: "silent",
    packages: "external",
    platform: "node",
    target: "node20",
    write: false,
  });
  const mod = await importBundledCode(
    result.outputFiles[0]?.text ?? "",
    "storybook"
  );
  const { mdxToAscii } = mod;
  if (typeof mdxToAscii !== "function") {
    throw new TypeError("mdxr: ascii module did not export mdxToAscii");
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const toAscii = mdxToAscii as (
    source: string,
    filePath: string
  ) => Promise<{ markdown: string }>;
  return async (mdxPath) => {
    const source = await readFile(mdxPath, "utf-8");
    const { markdown } = await toAscii(source, mdxPath);
    return markdown;
  };
};

const errorPage = (err: unknown): string => {
  const msg = err instanceof Error ? err.message : String(err);
  return `<!doctype html><meta charset="utf-8"><body style="font-family:monospace;background:#1c1917;color:#fca5a5;padding:2rem"><h1>mdxr render error</h1><pre>${msg.replaceAll("<", "&lt;")}</pre></body>`;
};

const renderDocument = async (
  file: string,
  render: RenderFile
): Promise<readonly [string, string]> => {
  const name = path.relative(docsDir, file);
  try {
    return [name, await render(file)];
  } catch (error) {
    return [name, errorPage(error)];
  }
};

const renderDocuments = async function* renderDocuments(
  files: string[],
  render: RenderFile
): AsyncGenerator<readonly [string, string]> {
  for (const file of files) {
    yield renderDocument(file, render);
  }
};

/**
 * Exposes `virtual:mdxr-documents`: every .mdx file under examples/ rendered
 * through the real `renderFile` pipeline (frontmatter, project components,
 * Tailwind) as a standalone HTML string. Stories display them in an iframe
 * via srcdoc.
 */
const mdxrDocuments = (): Plugin => ({
  configureServer: (server) => {
    server.watcher.add(docsDir);
    server.watcher.add(srcDir);
  },
  handleHotUpdate: ({ file, server }) => {
    const watched = file.startsWith(docsDir) || file.startsWith(srcDir);
    const mods = watched
      ? [RESOLVED_ID, ASCII_RESOLVED_ID].flatMap((id) => {
          const m = server.moduleGraph.getModuleById(id);
          return m === undefined ? [] : [m];
        })
      : [];
    for (const mod of mods) {
      server.moduleGraph.invalidateModule(mod);
    }
    // Returning undefined lets Vite's default HMR pipeline continue.
    return mods.length === 0 ? undefined : mods;
  },
  async load(id) {
    if (id !== RESOLVED_ID && id !== ASCII_RESOLVED_ID) {
      return null;
    }
    const watched = [
      ...(await listFiles(docsDir)),
      ...(await listFiles(srcDir)),
    ];
    for (const file of watched) {
      this.addWatchFile(file);
    }
    const render =
      id === RESOLVED_ID ? await loadRenderer() : await loadAscii();
    const docs: Record<string, string> = {};
    const docFiles = await listFiles(docsDir);
    const mdxFiles = docFiles.filter((f) => f.endsWith(".mdx"));
    // Each render builds CSS and hydration bundles. Keep Vite responsive to
    // browser imports while the growing catalog is compiled on a cold start.
    for await (const [name, html] of renderDocuments(mdxFiles, render)) {
      docs[name] = html;
    }
    return `export default ${JSON.stringify(docs)};`;
  },
  name: "mdxr-documents",
  resolveId: (id) => {
    if (id === VIRTUAL_ID) {
      return RESOLVED_ID;
    }
    if (id === ASCII_ID) {
      return ASCII_RESOLVED_ID;
    }
    return null;
  },
});

const config: StorybookConfig = {
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
  ],
  framework: "@storybook/react-vite",
  staticDirs: [{ from: "../examples/catalog/assets", to: "/assets" }],
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      plugins: [
        tailwindcss(),
        mdxrDocuments(),
        mdxrComponentDocuments(rootDir, loadRenderer),
      ],
      resolve: { alias: { "@": srcDir } },
    }),
};

export default config;

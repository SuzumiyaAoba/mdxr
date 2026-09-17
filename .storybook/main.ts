import { createHash } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import { build } from "esbuild";
import type { Plugin } from "vite";
import { mergeConfig } from "vite";

const VIRTUAL_ID = "virtual:mdxr-documents";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

const rootDir = process.cwd();
const docsDir = path.join(rootDir, "examples");
const srcDir = path.join(rootDir, "src");
const rendererEntry = path.join(srcDir, "render.ts");
const cacheDir = path.join(rootDir, ".mdxr-cache");

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

/**
 * Bundle the real renderer (`src/render.ts`) on every call and import it.
 * Re-bundling keeps document previews in sync with edits to src/**, and the
 * output lands in .mdxr-cache so bare imports resolve to this project's deps —
 * the same trick `loadUserModule` uses for user components.
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
  const code = result.outputFiles[0]?.text ?? "";
  await mkdir(cacheDir, { recursive: true });
  const hash = createHash("sha256").update(code).digest("hex").slice(0, 12);
  const out = path.join(cacheDir, `storybook-${hash}.mjs`);
  await writeFile(out, code);
  const mod: unknown = await import(
    `${pathToFileURL(out).href}?t=${Date.now()}`
  );
  const renderFile =
    typeof mod === "object" && mod !== null && "renderFile" in mod
      ? mod.renderFile
      : undefined;
  if (typeof renderFile !== "function") {
    throw new TypeError("mdxr: renderer module did not export renderFile");
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return renderFile as RenderFile;
};

const errorPage = (err: unknown): string => {
  const msg = err instanceof Error ? err.message : String(err);
  return `<!doctype html><meta charset="utf-8"><body style="font-family:monospace;background:#1c1917;color:#fca5a5;padding:2rem"><h1>mdxr render error</h1><pre>${msg.replaceAll("<", "&lt;")}</pre></body>`;
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
    const mod = watched
      ? server.moduleGraph.getModuleById(RESOLVED_ID)
      : undefined;
    if (mod !== undefined) {
      server.moduleGraph.invalidateModule(mod);
    }
    // Returning undefined lets Vite's default HMR pipeline continue.
    return mod === undefined ? undefined : [mod];
  },
  async load(id) {
    if (id !== RESOLVED_ID) {
      return null;
    }
    const watched = [
      ...(await listFiles(docsDir)),
      ...(await listFiles(srcDir)),
    ];
    for (const file of watched) {
      this.addWatchFile(file);
    }
    const renderFile = await loadRenderer();
    const docs: Record<string, string> = {};
    const docFiles = await listFiles(docsDir);
    const mdxFiles = docFiles.filter((f) => f.endsWith(".mdx"));
    await Promise.all(
      mdxFiles.map(async (file) => {
        const name = path.relative(docsDir, file);
        try {
          docs[name] = await renderFile(file);
        } catch (error) {
          docs[name] = errorPage(error);
        }
      })
    );
    return `export default ${JSON.stringify(docs)};`;
  },
  name: "mdxr-documents",
  resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : undefined),
});

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      plugins: [tailwindcss(), mdxrDocuments()],
      resolve: { alias: { "@": srcDir } },
    }),
};

export default config;

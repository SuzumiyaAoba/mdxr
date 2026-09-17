import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ResolvedConfig } from "./config.js";
import { loadConfig } from "./config.js";
import type { ComponentMap } from "./define.js";
import { formatError } from "./format-error.js";
import { isComponent, isRecord } from "./guards.js";
import { htmlDocument } from "./html.js";
import { buildHydrateScript } from "./hydrate.js";
import { loadUserModule, resolveModuleEntry } from "./load-user-module.js";
import { mdxToHtml } from "./mdx.js";
import { pkgRoot } from "./paths.js";
import type { CssSource } from "./tailwind.js";
import { buildCss } from "./tailwind.js";
import { takeUsedIcons } from "./ui/icon.js";
import { builtinComponents } from "./ui/index.js";
import { PlanHeader } from "./ui/plan.js";

export interface LoadedComponents {
  components: ComponentMap;
  code?: string;
}

/** Load a user components module (file or directory with an index file). */
export const loadComponents = async (
  componentsPath: string
): Promise<LoadedComponents> => {
  const entry = resolveModuleEntry(componentsPath);
  const { module: mod, code } = await loadUserModule(entry);
  const components: ComponentMap = {};
  for (const [key, val] of Object.entries(mod)) {
    if (key === "default") {
      // A default-exported object is treated as a { Name: Component } map.
      if (isRecord(val)) {
        for (const [k, v] of Object.entries(val)) {
          if (isComponent(v)) {
            components[k] = v;
          }
        }
      }
    } else if (isComponent(val) && /^[A-Z]/u.test(key)) {
      components[key] = val;
    }
  }
  return { code, components };
};

/** Read all of our own shipped JS so Tailwind can scan built-in classes. */
const ownSources = async (): Promise<CssSource[]> => {
  const dirs = [path.join(pkgRoot, "dist"), path.join(pkgRoot, "src")];
  const out: CssSource[] = [];
  const walk = async (d: string): Promise<void> => {
    const ents = await readdir(d, { withFileTypes: true });
    await Promise.all(
      ents.map(async (e) => {
        const p = path.join(d, e.name);
        if (e.isDirectory()) {
          await walk(p);
        } else if (/\.(?:js|ts|tsx)$/u.test(e.name)) {
          out.push({
            content: await readFile(p, "utf-8"),
            extension: e.name.split(".").pop() ?? "",
          });
        }
      })
    );
  };
  await Promise.all(dirs.filter((d) => existsSync(d)).map(walk));
  return out;
};

export interface RenderOptions {
  liveReload?: boolean;
  /**
   * Inline a client bundle that hydrates the document (`hydrateRoot`), making
   * interactive components (Tabs, Accordion, Switch, …) actually work.
   * Default true; `false` emits purely static HTML.
   */
  hydrate?: boolean;
}

export interface RenderSourceOptions extends RenderOptions {
  /**
   * Project directory: where `mdxr.config.ts` is looked up and where relative
   * paths (e.g. `<CodeFile path="…">`) resolve. Defaults to the cwd.
   */
  dir?: string;
  /**
   * Document path used in error messages and as the base for relative paths.
   * Defaults to `<dir>/document.mdx`.
   */
  filePath?: string;
}

/**
 * Inline client bundle for hydration. No catalog component was read → nothing
 * in the document can hydrate, so the bundle is skipped entirely (pure
 * markdown docs stay lean). A bundle failure degrades to the (correct)
 * static output with a warning.
 */
const buildHydrateBundle = async (args: {
  code: string;
  config: ResolvedConfig;
  fileLinks: Record<string, string>;
  headerProps?: Record<string, string | undefined>;
  hydrate?: boolean;
  usedComponents: string[];
  usedIcons: string[];
}): Promise<string | undefined> => {
  if (!(args.hydrate ?? true) || args.usedComponents.length === 0) {
    return undefined;
  }
  try {
    return await buildHydrateScript({
      code: args.code,
      componentsPath:
        args.config.componentsPath === undefined
          ? undefined
          : resolveModuleEntry(args.config.componentsPath),
      fileLinks: args.fileLinks,
      header: args.headerProps,
      usedComponents: args.usedComponents,
      usedIcons: args.usedIcons,
    });
  } catch (error) {
    process.stderr.write(
      `mdxr: hydration bundle skipped: ${formatError(error)}\n`
    );
    return undefined;
  }
};

/** Render MDX source text to a standalone HTML document. */
export const render = async (
  source: string,
  opts: RenderSourceOptions = {}
): Promise<string> => {
  const dir = path.resolve(opts.dir ?? process.cwd());
  const filePath = opts.filePath ?? path.join(dir, "document.mdx");
  const config: ResolvedConfig = await loadConfig(dir);

  const user =
    config.componentsPath === undefined
      ? { components: {} }
      : await loadComponents(config.componentsPath);

  const collisions = Object.keys(user.components).filter(
    (k) => k in builtinComponents
  );
  for (const k of collisions) {
    process.stderr.write(
      `mdxr: project component <${k}> overrides the built-in\n`
    );
  }

  const components: ComponentMap = {
    ...builtinComponents,
    ...user.components,
  };

  const { body, code, fileLinks, frontmatter, usedComponents, usedIcons } =
    await mdxToHtml(source, components, filePath, {
      editor: config.editor,
    });

  const themeCss =
    config.themePath === undefined
      ? undefined
      : await readFile(config.themePath, "utf-8");

  // Every class that made it into the rendered output is a candidate;
  // scanning the body covers both built-in and user components.
  const sources: CssSource[] = [
    { content: body, extension: "html" },
    { content: source, extension: "mdx" },
    { content: themeCss ?? "", extension: "css" },
    ...(await ownSources()),
    ...(user.code === undefined
      ? []
      : [{ content: user.code, extension: "js" }]),
    ...(config.componentsCode === undefined
      ? []
      : [{ content: config.componentsCode, extension: "js" }]),
  ];
  const { css } = await buildCss(sources, themeCss);

  const fmTitle =
    typeof frontmatter.title === "string" ? frontmatter.title : undefined;
  const title =
    fmTitle ??
    /<h1[^>]*>(?<text>[^<]+)</u.exec(body)?.groups?.text ??
    "mdxr document";

  const fmStr = (key: string): string | undefined => {
    const val: unknown = frontmatter[key];
    if (typeof val === "string") {
      return val === "" ? undefined : val;
    }
    // YAML parses `date: 2026-09-16` into a Date.
    if (val instanceof Date) {
      return val.toISOString().slice(0, 10);
    }
    return typeof val === "number" ? String(val) : undefined;
  };

  const headerProps =
    fmTitle !== undefined && fmTitle !== "" && !/<article/u.test(body)
      ? {
          date: fmStr("date"),
          owner: fmStr("owner"),
          status: fmStr("status"),
          title: fmTitle,
          updated: fmStr("updated"),
          version: fmStr("version"),
        }
      : undefined;
  const header =
    headerProps === undefined
      ? ""
      : renderToStaticMarkup(createElement(PlanHeader, headerProps));

  // Icon recording spans both SSR passes (body inside mdxToHtml, header here).
  usedIcons.push(...takeUsedIcons());

  const hydrateJs = await buildHydrateBundle({
    code,
    config,
    fileLinks,
    headerProps,
    hydrate: opts.hydrate,
    usedComponents,
    usedIcons,
  });

  return htmlDocument({
    body: header + body,
    css,
    hydrateJs,
    liveReload: opts.liveReload,
    needsKatex: /class="[^"]*katex/u.test(body),
    needsMermaid: /class="[^"]*mermaid/u.test(body),
    title,
  });
};

/** Read `mdxPath` and render it to a standalone HTML document. */
export const renderFile = async (
  mdxPath: string,
  opts: RenderOptions = {}
): Promise<string> => {
  const abs = path.resolve(mdxPath);
  const source = await readFile(abs, "utf-8");
  return await render(source, {
    ...opts,
    dir: path.dirname(abs),
    filePath: abs,
  });
};

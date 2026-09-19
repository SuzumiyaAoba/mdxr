import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { createElement } from "react";

import { clientJs } from "./client-js.js";
import { mergeUserComponents } from "./component-map.js";
import type { ResolvedConfig } from "./config.js";
import { loadConfig } from "./config.js";
import type { ComponentMap } from "./define.js";
import { formatError } from "./format-error.js";
import { nonEmpty } from "./guards.js";
import { htmlDocument } from "./html.js";
import { buildHydrateScript } from "./hydrate.js";
import { loadUserModule, resolveModuleEntry } from "./load-user-module.js";
import { mdxToHtml } from "./mdx.js";
import { pkgRoot } from "./paths.js";
import type { CssSource } from "./tailwind.js";
import { buildCss } from "./tailwind.js";
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
  return { code, components: mergeUserComponents(mod) };
};

/** Components named by `config.componentsPath` — an empty map when unset. */
export const loadUserComponents = async (
  config: ResolvedConfig
): Promise<LoadedComponents> =>
  config.componentsPath === undefined
    ? { components: {} }
    : await loadComponents(config.componentsPath);

/** Read all of our own shipped JS so Tailwind can scan built-in classes.
 *  Memoized: package sources don't change within a process (serve rebuilds
 *  would otherwise rescan dist+src on every keystroke). */
let ownSourcesCache: CssSource[] | undefined;
const ownSources = async (): Promise<CssSource[]> => {
  if (ownSourcesCache !== undefined) {
    return ownSourcesCache;
  }
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
  ownSourcesCache = out;
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
  /**
   * Files the render pulled in (theme CSS and its imports) — `mdxr serve`
   * registers them as extra watch targets so edits outside the document's
   * own directory still trigger a rebuild.
   */
  onDependencies?: (paths: string[]) => void;
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
  now: string;
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
      now: args.now,
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

/**
 * PlanHeader props from frontmatter — present only with a `title` and no
 * `<Plan>`-style `<article>` root in the body (that would render a second
 * header). Used for both the SSR header and the hydration payload.
 */
const frontmatterHeader = (
  fm: (key: string) => string | undefined,
  body: string
): Record<string, string | undefined> | undefined => {
  const title = fm("title");
  if (title === undefined || title === "" || /<article/u.test(body)) {
    return undefined;
  }
  return {
    date: fm("date"),
    owner: fm("owner"),
    status: fm("status"),
    title,
    updated: fm("updated"),
    version: fm("version"),
  };
};

/** Render MDX source text to a standalone HTML document. */
export const render = async (
  source: string,
  opts: RenderSourceOptions = {}
): Promise<string> => {
  const dir = path.resolve(opts.dir ?? process.cwd());
  const filePath = opts.filePath ?? path.join(dir, "document.mdx");
  const config: ResolvedConfig = await loadConfig(dir);

  const user = await loadUserComponents(config);

  // hasOwn, not `in`: prototype names ("toString", "constructor") are not
  // catalog collisions.
  const collisions = Object.keys(user.components).filter((k) =>
    Object.hasOwn(builtinComponents, k)
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

  const {
    body,
    code,
    fileLinks,
    frontmatter,
    renderedAt,
    renderWithHeader,
    usedComponents,
    usedIcons,
  } = await mdxToHtml(source, components, filePath, {
    editor: config.editor,
    hydrate: opts.hydrate,
  });

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

  const fmTitle = fmStr("title");
  // `<h1>` may hold inline elements — take the full inner HTML, drop the
  // tags, and undo the entities React emitted (escapeHtml re-encodes).
  const h1Text = /<h1[^>]*>(?<text>[\s\S]*?)<\/h1>/u
    .exec(body)
    ?.groups?.text.replaceAll(/<[^>]*>/gu, "")
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .trim();
  const title =
    fmTitle ?? (nonEmpty(h1Text) ? h1Text : undefined) ?? "mdxr document";

  const headerProps = frontmatterHeader(fmStr, body);
  // The header must be part of the body's vnode tree, not concatenated HTML:
  // the hydration client mounts Provider > Fragment > [header|null, doc] and
  // useId() encodes tree position — separately rendered markup would shift
  // every id/name/htmlFor hydration compares.
  let docBody = body;
  let docFileLinks = fileLinks;
  let docIcons = usedIcons;
  if (headerProps !== undefined) {
    const pass = renderWithHeader(createElement(PlanHeader, headerProps));
    docBody = pass.html;
    docFileLinks = pass.fileLinks;
    docIcons = pass.usedIcons;
  }

  // Read once for the candidate scan; the build imports the theme by path so
  // relative `@import`s inside it resolve against the theme's own directory.
  const themeCss =
    config.themePath === undefined
      ? undefined
      : await readFile(config.themePath, "utf-8");

  // Every class that made it into the rendered output is a candidate;
  // scanning the body covers both built-in and user components.
  const sources: CssSource[] = [
    { content: docBody, extension: "html" },
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
  const { css, dependencies } = await buildCss(sources, config.themePath);
  opts.onDependencies?.(dependencies);

  const [js, hydrateJs] = await Promise.all([
    clientJs(),
    buildHydrateBundle({
      code,
      config,
      fileLinks: docFileLinks,
      headerProps,
      hydrate: opts.hydrate,
      now: renderedAt,
      usedComponents,
      usedIcons: docIcons,
    }),
  ]);

  return htmlDocument({
    body: docBody,
    clientJs: js,
    css,
    hydrateJs,
    liveReload: opts.liveReload,
    needsKatex: /class="[^"]*katex/u.test(docBody),
    needsMermaid: /class="[^"]*mermaid/u.test(docBody),
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

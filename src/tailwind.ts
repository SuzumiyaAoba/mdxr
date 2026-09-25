import { access } from "node:fs/promises";
import module from "node:module";
import path from "node:path";

import { compile, optimize } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";

import { BASE_CSS } from "./assets/css.js";
import { pkgRoot } from "./paths.js";

const require = module.createRequire(import.meta.url);
const tailwindDir = path.dirname(require.resolve("tailwindcss/package.json"));

/** Resolve `id` against the document dir then this package; false if absent. */
const tryResolve = async (
  id: string,
  base: string
): Promise<string | false> => {
  try {
    const resolved = require.resolve(id, { paths: [base, pkgRoot] });
    await access(resolved);
    return resolved;
  } catch {
    return false;
  }
};

const resolveCss = async (
  id: string,
  base: string
): Promise<string | false> => {
  // Absolute ids (the theme file is @import'ed by path) resolve to themselves.
  if (path.isAbsolute(id)) {
    return id;
  }
  // Tailwind v4 ships its CSS layers as files inside the package.
  if (id === "tailwindcss") {
    return path.join(tailwindDir, "index.css");
  }
  if (id.startsWith("tailwindcss/")) {
    return path.join(tailwindDir, id.slice("tailwindcss/".length));
  }
  if (id.startsWith(".")) {
    return path.resolve(base, id);
  }
  return await tryResolve(id, base);
};

export interface CssSource {
  content: string;
  extension: string;
}

/**
 * React escapes `&` `'` `"` `<` `>` inside rendered attributes. The scanner
 * must see the literal class text, so decode the entities React emits.
 */
const decodeEntities = (html: string): string =>
  html
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

/** `@import "<path>"` — quoted, with Windows separators normalized. */
const importLine = (absPath: string): string =>
  `@import ${JSON.stringify(absPath.replaceAll("\\", "/"))};`;

/**
 * Compile Tailwind v4 CSS covering every class candidate found in `sources`
 * (the rendered HTML, the .mdx source, bundled user components, our own dist).
 * `themePath` is imported by path — not inlined — so `@import "./x.css"`
 * inside a theme file resolves relative to the theme, and the file lands in
 * `dependencies` (which `mdxr serve` turns into watch targets).
 * Returns minified CSS ready to inline into the HTML document.
 */
export const buildCss = async (
  sources: CssSource[],
  themePath?: string
): Promise<{ css: string; dependencies: string[] }> => {
  const input = [
    // globals.css holds the shadcn/Base UI theme tokens (@theme, :root/.dark
    // vars, custom variants) shared with Storybook; it imports tailwind itself.
    '@import "./src/styles/globals.css";',
    '@import "./src/assets/annotations.css";',
    '@plugin "@tailwindcss/typography";',
    // Iconify icons as CSS classes: `icon-[lucide--check]` (dynamic, any
    // installed @iconify-json/* set works).
    '@plugin "@iconify/tailwind4";',
    BASE_CSS,
    themePath === undefined ? "" : importLine(themePath),
  ].join("\n");

  // `onDependency` is optional in the types but invoked unconditionally
  // inside @tailwindcss/node — and it tells us which files mdxr serve
  // should watch.
  const dependencies = new Set<string>();
  const compiler = await compile(input, {
    base: pkgRoot,
    customCssResolver: resolveCss,
    customJsResolver: tryResolve,
    onDependency: (file) => {
      dependencies.add(file);
    },
  });

  const candidates = new Scanner({}).scanFiles(
    sources.map((s) => ({
      content: s.extension === "html" ? decodeEntities(s.content) : s.content,
      extension: s.extension,
    }))
  );

  const css = compiler.build(candidates);
  return {
    css: optimize(css, { minify: true }).code,
    dependencies: [...dependencies],
  };
};

import { access } from "node:fs/promises";
import module from "node:module";
import path from "node:path";

import { compile, optimize } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";

import { BASE_CSS } from "./assets.js";
import { pkgRoot } from "./paths.js";

const require = module.createRequire(import.meta.url);
const tailwindDir = path.dirname(require.resolve("tailwindcss/package.json"));

const resolveCss = async (
  id: string,
  base: string
): Promise<string | false> => {
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
  try {
    const resolved = require.resolve(id, { paths: [base, pkgRoot] });
    await access(resolved);
    return resolved;
  } catch {
    return false;
  }
};

const resolveJs = async (id: string, base: string): Promise<string | false> => {
  try {
    const resolved = require.resolve(id, { paths: [base, pkgRoot] });
    await access(resolved);
    return resolved;
  } catch {
    return false;
  }
};

export interface CssSource {
  content: string;
  extension: string;
}

/**
 * Compile Tailwind v4 CSS covering every class candidate found in `sources`
 * (the rendered HTML, the .mdx source, bundled user components, our own dist).
 * Returns minified CSS ready to inline into the HTML document.
 */
export const buildCss = async (
  sources: CssSource[],
  themeCss?: string
): Promise<{ css: string; dependencies: string[] }> => {
  const input = [
    '@import "tailwindcss";',
    '@plugin "@tailwindcss/typography";',
    BASE_CSS,
    themeCss ?? "",
  ].join("\n");

  // `onDependency` is optional in the types but invoked unconditionally
  // inside @tailwindcss/node — and it tells us which files rv serve
  // should watch.
  const dependencies = new Set<string>();
  const compiler = await compile(input, {
    base: pkgRoot,
    customCssResolver: resolveCss,
    customJsResolver: resolveJs,
    onDependency: (file) => {
      dependencies.add(file);
    },
  });

  const candidates = new Scanner({}).scanFiles(
    sources.map((s) => ({ content: s.content, extension: s.extension }))
  );

  const css = compiler.build(candidates);
  return {
    css: optimize(css, { minify: true }).code,
    dependencies: [...dependencies],
  };
};

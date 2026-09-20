import module from "node:module";
import path from "node:path";
import url from "node:url";

const require = module.createRequire(import.meta.url);

const findPkgRoot = (): string => {
  try {
    return path.dirname(
      url.fileURLToPath(require.resolve("@suzumiyaaoba/mdxr/package.json"))
    );
  } catch {
    // Bundled (dist/*.mjs) and source (src/*.ts) layouts both sit one level
    // below the package root.
    return url.fileURLToPath(new URL("..", import.meta.url));
  }
};

/** Absolute path to this package's root (works bundled, unbundled, and via npx). */
export const pkgRoot = findPkgRoot();

/**
 * This package's `src/` directory. The hydration bundle is always built from
 * the TypeScript sources — they ship with the package, so packed installs
 * and local dev produce identical bundles. Building from sources (rather
 * than the packed `dist/` chunks) is also what makes tree-shaking effective:
 * every used component is imported from its leaf module, and no barrel file
 * is ever loaded.
 */
export const srcDir = path.join(pkgRoot, "src");

/** Directory where bundled user modules are cached. Kept inside this package so
 *  bare imports (`react`, `valibot`, `@suzumiyaaoba/mdxr`) resolve to *our*
 *  copy —
 *  guaranteeing a single React instance shared with renderToStaticMarkup. */
export const cacheDir = `${pkgRoot}/.mdxr-cache`;

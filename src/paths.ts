import module from "node:module";
import path from "node:path";
import url from "node:url";

const require = module.createRequire(import.meta.url);

const findPkgRoot = (): string => {
  try {
    return path.dirname(
      url.fileURLToPath(require.resolve("@suzumiyaaoba/rv/package.json"))
    );
  } catch {
    // Bundled (dist/*.mjs) and source (src/*.ts) layouts both sit one level
    // below the package root.
    return url.fileURLToPath(new URL("..", import.meta.url));
  }
};

/** Absolute path to this package's root (works bundled, unbundled, and via npx). */
export const pkgRoot = findPkgRoot();

/** Directory where bundled user modules are cached. Kept inside this package so
 *  bare imports (`react`, `valibot`, `@suzumiyaaoba/rv`) resolve to *our* copy —
 *  guaranteeing a single React instance shared with renderToStaticMarkup. */
export const cacheDir = `${pkgRoot}/.rv-cache`;

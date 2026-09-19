/**
 * esbuild plugins for the hydration bundle: pin shared packages to mdxr's own
 * node_modules (a second React copy would break hooks/context), feed the
 * compiled MDX module in as a virtual import, and shrink bundled icon sets to
 * the names a document actually rendered.
 */

import { icons as lucide } from "@iconify-json/lucide";
import { icons as vscodeIcons } from "@iconify-json/vscode-icons";
import type { Plugin } from "esbuild";

import { SHARED_PACKAGES } from "../load-user-module.js";
import { pkgRoot, srcDir } from "../paths.js";

/**
 * Everything the document bundle shares with mdxr itself — React above all
 * (a second copy would break hooks/context) — is resolved from this package's
 * own node_modules regardless of where the user's components live.
 * (esbuild serializes onResolve filters to Go's RE2: no `u` flag.)
 */
/* oxlint-disable require-unicode-regexp -- esbuild onResolve filters forbid `u` */
const SHARED_RE = new RegExp(`^(?:${SHARED_PACKAGES.join("|")})(?:/.*)?$`);

export const pinShared: Plugin = {
  name: "mdxr:pin-shared",
  setup(b) {
    b.onResolve({ filter: SHARED_RE }, async (args) => {
      // b.resolve re-enters this plugin — pluginData marks the inner call so
      // the recursion stops after exactly one delegation.
      if (args.pluginData === pinShared) {
        return null;
      }
      const r = await b.resolve(args.path, {
        kind: args.kind,
        pluginData: pinShared,
        resolveDir: pkgRoot,
      });
      return r.errors.length === 0 ? { path: r.path } : null;
    });
  },
};
/* oxlint-enable require-unicode-regexp */

/** The compiled MDX module enters the bundle as a virtual `mdxr:doc` import. */
/* oxlint-disable require-unicode-regexp -- esbuild onResolve/onLoad filters forbid `u` */
export const docModule = (code: string): Plugin => ({
  name: "mdxr:doc",
  setup(b) {
    b.onResolve({ filter: /^mdxr:doc$/ }, () => ({
      namespace: "mdxr-doc",
      path: "mdxr:doc",
    }));
    b.onLoad({ filter: /^mdxr:doc$/, namespace: "mdxr-doc" }, () => ({
      contents: code,
      loader: "js",
      resolveDir: srcDir,
    }));
  },
});
/* oxlint-enable require-unicode-regexp */

const ICON_SETS: Record<string, typeof lucide> = {
  "@iconify-json/lucide": lucide,
  "@iconify-json/vscode-icons": vscodeIcons,
};

/**
 * The bundled icon sets are several MB of JSON; a document only ever renders
 * the icons recorded during SSR. Redirecting each `@iconify-json/*` import to
 * a partial collection (used names only, alias parents included) keeps
 * `addCollection` calls working while shipping kilobytes, not megabytes.
 */
/* oxlint-disable require-unicode-regexp -- esbuild onResolve/onLoad filters forbid `u` */
export const iconSets = (usedIcons: readonly string[]): Plugin => ({
  name: "mdxr:icons",
  setup(b) {
    b.onResolve({ filter: /^@iconify-json\// }, (args) => ({
      namespace: "mdxr-icons",
      path: args.path,
    }));
    b.onLoad(
      { filter: /^@iconify-json\//, namespace: "mdxr-icons" },
      (args) => {
        const set = ICON_SETS[args.path];
        if (set === undefined) {
          return { contents: "export const icons = {};", loader: "js" };
        }
        const icons: Record<string, unknown> = {};
        const aliases: Record<string, unknown> = {};
        for (const full of usedIcons) {
          const [prefix, name] = full.split(":");
          if (prefix !== set.prefix || name === undefined) {
            continue;
          }
          // hasOwn: names like "toString" must not pull prototype members —
          // a function would serialize as `{}` and ship a phantom icon.
          if (Object.hasOwn(set.icons, name)) {
            icons[name] = set.icons[name];
          }
          const alias = Object.hasOwn(set.aliases ?? {}, name)
            ? set.aliases?.[name]
            : undefined;
          if (alias !== undefined) {
            aliases[name] = alias;
            if (Object.hasOwn(set.icons, alias.parent)) {
              icons[alias.parent] = set.icons[alias.parent];
            }
          }
        }
        return {
          contents: `export const icons = ${JSON.stringify({ ...set, aliases, icons })};`,
          loader: "js",
        };
      }
    );
  },
});
/* oxlint-enable require-unicode-regexp */

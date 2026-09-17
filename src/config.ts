import fs from "node:fs";
import path from "node:path";

import { isRecord, nonEmpty } from "./guards.js";
import { loadUserModule } from "./load-user-module.js";

/** Shape of `mdxr.config.ts` in a project that uses mdxr. */
export interface MdxrConfig {
  /** Path to a TS/TSX module whose named exports are extra MDX components. */
  components?: string;
  /**
   * Editor used for file links (`vscode` default). A known name (`cursor`,
   * `zed`, `vscode-insiders`, `windsurf`, `sublime`, `textmate`, `idea`), a
   * `{path}`/`{line}` URL template, or `"none"` to disable. Frontmatter
   * `editor:` overrides per document.
   */
  editor?: string;
  /** Path to a CSS file with `@theme` overrides / extra utilities. */
  theme?: string;
}

export const defineConfig = (config: MdxrConfig): MdxrConfig => config;

export interface ResolvedConfig {
  componentsPath?: string;
  themePath?: string;
  /** Bundled mdxr.config code (Tailwind scan source). */
  componentsCode?: string;
  dir: string;
  editor?: string;
}

const CONFIG_FILES = [
  "mdxr.config.ts",
  "mdxr.config.mts",
  "mdxr.config.js",
  "mdxr.config.mjs",
];

export const loadConfig = async (dir: string): Promise<ResolvedConfig> => {
  const name = CONFIG_FILES.find((n) => fs.existsSync(path.join(dir, n)));
  if (name === undefined) {
    return { dir };
  }
  const { module: mod, code } = await loadUserModule(path.join(dir, name));
  const raw = isRecord(mod.default) ? mod.default : {};
  const components =
    typeof raw.components === "string" ? raw.components : undefined;
  const editor = typeof raw.editor === "string" ? raw.editor : undefined;
  const theme = typeof raw.theme === "string" ? raw.theme : undefined;
  return {
    componentsCode: code,
    componentsPath: nonEmpty(components)
      ? path.resolve(dir, components)
      : undefined,
    dir,
    editor: nonEmpty(editor) ? editor : undefined,
    themePath: nonEmpty(theme) ? path.resolve(dir, theme) : undefined,
  };
};

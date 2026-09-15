import fs from "node:fs";
import path from "node:path";

import { isRecord, nonEmpty } from "./guards.js";
import { loadUserModule } from "./load-user-module.js";

/** Shape of `rv.config.ts` in a project that uses rv. */
export interface RvConfig {
  /** Path to a TS/TSX module whose named exports are extra MDX components. */
  components?: string;
  /** Path to a CSS file with `@theme` overrides / extra utilities. */
  theme?: string;
}

export const defineConfig = (config: RvConfig): RvConfig => config;

export interface ResolvedConfig {
  componentsPath?: string;
  themePath?: string;
  /** Bundled rv.config code (Tailwind scan source). */
  componentsCode?: string;
  dir: string;
}

const CONFIG_FILES = [
  "rv.config.ts",
  "rv.config.mts",
  "rv.config.js",
  "rv.config.mjs",
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
  const theme = typeof raw.theme === "string" ? raw.theme : undefined;
  return {
    componentsCode: code,
    componentsPath: nonEmpty(components)
      ? path.resolve(dir, components)
      : undefined,
    dir,
    themePath: nonEmpty(theme) ? path.resolve(dir, theme) : undefined,
  };
};

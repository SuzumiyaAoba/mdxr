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
  dependencies?: string[];
  configPath?: string;
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

export interface ConfigOptions {
  /** Explicit configuration file; resolved from the working directory. */
  config?: string;
  /** Explicit project root, also the upper bound of ancestor discovery. */
  project?: string;
}

export const findProjectRoot = (directory: string): string => {
  let current = path.resolve(directory);
  while (true) {
    if (
      fs.existsSync(path.join(current, ".git")) ||
      fs.existsSync(path.join(current, "package.json"))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return process.cwd();
    }
    current = parent;
  }
};

/** Discover configuration without executing project code. Stop at a project boundary. */
export const findConfig = (
  dir: string,
  options: ConfigOptions = {}
): string | undefined => {
  if (options.config !== undefined) {
    const file = path.resolve(options.config);
    if (!fs.existsSync(file)) {
      throw new Error(`Configuration file does not exist: ${file}`);
    }
    return file;
  }
  const root =
    options.project === undefined ? undefined : path.resolve(options.project);
  let current = path.resolve(dir);
  if (
    root !== undefined &&
    current !== root &&
    !current.startsWith(`${root}${path.sep}`)
  ) {
    current = root;
  }
  while (true) {
    const directory = current;
    const name = CONFIG_FILES.find((candidate) =>
      fs.existsSync(path.join(directory, candidate))
    );
    if (name !== undefined) {
      return path.join(current, name);
    }
    const parent = path.dirname(current);
    if (
      current === root ||
      parent === current ||
      (root === undefined &&
        (fs.existsSync(path.join(current, ".git")) ||
          fs.existsSync(path.join(current, "package.json"))))
    ) {
      return undefined;
    }
    current = parent;
  }
};

export const loadConfig = async (
  dir: string,
  options: ConfigOptions = {}
): Promise<ResolvedConfig> => {
  const configPath = findConfig(dir, options);
  if (configPath === undefined) {
    return { dir: path.resolve(options.project ?? dir) };
  }
  const configDir = path.dirname(configPath);
  const { module: mod, code, dependencies } = await loadUserModule(configPath);
  const raw = isRecord(mod.default) ? mod.default : {};
  return {
    componentsCode: code,
    componentsPath: nonEmpty(raw.components)
      ? path.resolve(configDir, raw.components)
      : undefined,
    configPath,
    dependencies,
    dir: configDir,
    editor: nonEmpty(raw.editor) ? raw.editor : undefined,
    themePath: nonEmpty(raw.theme)
      ? path.resolve(configDir, raw.theme)
      : undefined,
  };
};

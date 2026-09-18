import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { pkgRoot } from "./paths.js";

const SKILL_DIRS: Record<string, { global: string; local: string }> = {
  agents: { global: ".agents/skills/mdxr", local: ".agents/skills/mdxr" },
  claude: { global: ".claude/skills/mdxr", local: ".claude/skills/mdxr" },
  devin: { global: ".config/devin/skills/mdxr", local: ".devin/skills/mdxr" },
};

export interface InitOptions {
  tool?: string;
  global?: boolean;
  force?: boolean;
}

export const installSkill = async (opts: InitOptions): Promise<string[]> => {
  const tool = opts.tool ?? "agents";
  const global = opts.global === true;
  const base = global ? os.homedir() : process.cwd();

  const tools = tool === "all" ? Object.keys(SKILL_DIRS) : [tool];
  const destFor = (t: string): string => {
    // hasOwn: `--tool toString` would otherwise pull a function off the
    // prototype and crash on `path.join(base, undefined)`.
    const dirs = Object.hasOwn(SKILL_DIRS, t) ? SKILL_DIRS[t] : undefined;
    if (dirs === undefined) {
      throw new Error(`unknown tool: ${t} (expected agents|claude|devin|all)`);
    }
    return path.join(base, global ? dirs.global : dirs.local);
  };
  for (const t of tools) {
    const dest = destFor(t);
    if (fs.existsSync(dest) && opts.force !== true) {
      throw new Error(`${dest} already exists (use --force to overwrite)`);
    }
  }

  return await Promise.all(
    tools.map(async (t) => {
      const dest = destFor(t);
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.cp(path.join(pkgRoot, "skill"), dest, {
        force: true,
        recursive: true,
      });
      return dest;
    })
  );
};

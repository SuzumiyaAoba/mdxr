import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { pkgRoot } from "./paths.js";

const LOCAL_DIRS: Record<string, string> = {
  agents: ".agents/skills/rv",
  claude: ".claude/skills/rv",
  devin: ".devin/skills/rv",
};

const GLOBAL_DIRS: Record<string, string> = {
  agents: ".agents/skills/rv",
  claude: ".claude/skills/rv",
  devin: ".config/devin/skills/rv",
};

export interface InitOptions {
  tool?: string;
  global?: boolean;
  force?: boolean;
}

export const installSkill = async (opts: InitOptions): Promise<string[]> => {
  const tool = opts.tool ?? "agents";
  const map = opts.global === true ? GLOBAL_DIRS : LOCAL_DIRS;
  const base = opts.global === true ? os.homedir() : process.cwd();

  const tools = tool === "all" ? Object.keys(map) : [tool];
  for (const t of tools) {
    if (!map[t]) {
      throw new Error(`unknown tool: ${t} (expected agents|claude|devin|all)`);
    }
    const dest = path.join(base, map[t]);
    if (fs.existsSync(dest) && opts.force !== true) {
      throw new Error(`${dest} already exists (use --force to overwrite)`);
    }
  }

  const installed = await Promise.all(
    tools.map(async (t) => {
      const dest = path.join(base, map[t]);
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.cp(path.join(pkgRoot, "skill"), dest, {
        force: true,
        recursive: true,
      });
      return dest;
    })
  );
  return installed;
};

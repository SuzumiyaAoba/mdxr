import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { own } from "./guards.js";
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

/** Scratch dir for agent-authored documents — must stay untracked. */
const DOCS_IGNORE = ".mdxr/";

/** Lines that already ignore the docs dir: .mdxr, .mdxr/, /.mdxr/, .mdxr/*, … */
const DOCS_IGNORED = /^\/?\.mdxr\/?\*{0,2}$/u;

/**
 * Ensures the project's .gitignore covers `.mdxr/` — created or appended
 * as needed. Returns "present" when an existing rule already covers it.
 */
export const ensureDocsDirIgnored = async (
  base: string
): Promise<"added" | "present"> => {
  const file = path.join(base, ".gitignore");
  const existing = await fsp.readFile(file, "utf-8").catch(() => null);
  if (
    existing?.split("\n").some((line) => DOCS_IGNORED.test(line.trim())) ===
    true
  ) {
    return "present";
  }
  const needsNewline =
    existing !== null && existing.length > 0 && !existing.endsWith("\n");
  await fsp.appendFile(file, `${needsNewline ? "\n" : ""}${DOCS_IGNORE}\n`);
  return "added";
};

export const installSkill = async (opts: InitOptions): Promise<string[]> => {
  const tool = opts.tool ?? "agents";
  const global = opts.global === true;
  const base = global ? os.homedir() : process.cwd();

  const tools = tool === "all" ? Object.keys(SKILL_DIRS) : [tool];
  // `own`: `--tool toString` would otherwise pull a function off the
  // prototype and crash on `path.join(base, undefined)`.
  const dests = tools.map((t) => {
    const dirs = own(SKILL_DIRS, t);
    if (dirs === undefined) {
      throw new Error(`unknown tool: ${t} (expected agents|claude|devin|all)`);
    }
    return path.join(base, global ? dirs.global : dirs.local);
  });
  for (const dest of dests) {
    if (fs.existsSync(dest) && opts.force !== true) {
      throw new Error(`${dest} already exists (use --force to overwrite)`);
    }
  }

  return await Promise.all(
    dests.map(async (dest) => {
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      if (opts.force === true) {
        // fs.cp only overwrites same-named files — files deleted or renamed
        // upstream would linger in dest. A force install replaces wholesale.
        await fsp.rm(dest, { force: true, recursive: true });
      }
      await fsp.cp(path.join(pkgRoot, "skill"), dest, {
        force: true,
        recursive: true,
      });
      return dest;
    })
  );
};

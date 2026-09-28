import { execFile } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

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
/** Negation rules that re-include the docs dir or any path beneath it. */
const DOCS_UNIGNORED = /^!\/?\.mdxr(?:\/.*)?$/u;

const docsDirIsIgnored = (source: string): boolean => {
  let ignored = false;
  for (const line of source.split("\n")) {
    const rule = line.trim();
    if (DOCS_IGNORED.test(rule)) {
      ignored = true;
    } else if (DOCS_UNIGNORED.test(rule)) {
      ignored = false;
    }
  }
  return ignored;
};

// execFile has a custom promisify signature that preserves both output streams.
// oxlint-disable-next-line typescript/strict-void-return
const execFileAsync = promisify(execFile);

/** `git config --get core.excludesFile`, or git's default global ignore. */
const globalExcludesFile = async (): Promise<string> => {
  const fallback = path.join(os.homedir(), ".config", "git", "ignore");
  try {
    const { stdout } = await execFileAsync("git", [
      "config",
      "--get",
      "core.excludesFile",
    ]);
    const configured = stdout.trim();
    if (configured === "") {
      return fallback;
    }
    // Git expands a leading ~ itself.
    return configured.startsWith("~/")
      ? path.join(os.homedir(), configured.slice(2))
      : configured;
  } catch {
    // No git, or the key is unset — the default location still applies.
    return fallback;
  }
};

/**
 * Ensures the project's .gitignore covers `.mdxr/` — created or appended
 * as needed. Returns "present" when an existing project rule covers it,
 * "global" when the user's global excludes file already does (nothing is
 * written — the project file would just duplicate it).
 */
export const ensureDocsDirIgnored = async (
  base: string
): Promise<"added" | "global" | "present"> => {
  const globalIgnore = await fsp
    .readFile(await globalExcludesFile(), "utf-8")
    .catch(() => null);
  if (globalIgnore !== null && docsDirIsIgnored(globalIgnore)) {
    return "global";
  }
  const file = path.join(base, ".gitignore");
  const existing = await fsp.readFile(file, "utf-8").catch(() => null);
  if (existing !== null && docsDirIsIgnored(existing)) {
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

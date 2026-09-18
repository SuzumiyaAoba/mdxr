import { mkdtemp, readdir, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { installSkill } from "../src/init.js";

describe(installSkill, () => {
  const tmpDirs: string[] = [];
  const originalCwd = process.cwd();

  const makeDir = async (): Promise<string> => {
    // realpath: process.cwd() resolves macOS's /var → /private/var symlink.
    const dir = await realpath(
      await mkdtemp(path.join(os.tmpdir(), "mdxr-init-"))
    );
    tmpDirs.push(dir);
    return dir;
  };

  afterEach(async () => {
    process.chdir(originalCwd);
    await Promise.all(
      tmpDirs.splice(0).map(async (d) => {
        await rm(d, { force: true, recursive: true });
      })
    );
  });

  it("installs the skill into .agents/skills/mdxr by default", async () => {
    const dir = await makeDir();
    process.chdir(dir);
    const paths = await installSkill({});
    expect(paths).toStrictEqual([path.join(dir, ".agents/skills/mdxr")]);
    const files = await readdir(paths[0] ?? "");
    expect(files).toContain("SKILL.md");
    expect(files).toContain("references");
  });

  it("installs into .claude/skills for the claude tool", async () => {
    const dir = await makeDir();
    process.chdir(dir);
    const paths = await installSkill({ tool: "claude" });
    expect(paths).toStrictEqual([path.join(dir, ".claude/skills/mdxr")]);
    await expect(readdir(paths[0] ?? "")).resolves.toContain("SKILL.md");
  });

  it("installs every supported tool with --tool all", async () => {
    const dir = await makeDir();
    process.chdir(dir);
    const paths = await installSkill({ tool: "all" });
    expect(paths).toHaveLength(3);
    await Promise.all(
      paths.map(async (p) => {
        await expect(readdir(p)).resolves.toContain("SKILL.md");
      })
    );
  });

  it("refuses to overwrite an existing skill without --force", async () => {
    const dir = await makeDir();
    process.chdir(dir);
    await installSkill({ tool: "agents" });
    await expect(installSkill({ tool: "agents" })).rejects.toThrow(
      /already exists/u
    );
    await expect(
      installSkill({ force: true, tool: "agents" })
    ).resolves.toStrictEqual([path.join(dir, ".agents/skills/mdxr")]);
  });

  it("rejects an unknown tool before writing anything", async () => {
    const dir = await makeDir();
    process.chdir(dir);
    await expect(installSkill({ tool: "bogus" })).rejects.toThrow(
      /unknown tool/u
    );
    await expect(readdir(dir)).resolves.toStrictEqual([]);
  });

  it("rejects prototype names as tools (toString is not a directory map entry)", async () => {
    // SKILL_DIRS["toString"] used to pull Object.prototype.toString off the
    // prototype — the undefined check passed and path.join(base, undefined)
    // crashed with a TypeError instead of the validation error.
    const dir = await makeDir();
    process.chdir(dir);
    await expect(installSkill({ tool: "toString" })).rejects.toThrow(
      /unknown tool/u
    );
    await expect(installSkill({ tool: "constructor" })).rejects.toThrow(
      /unknown tool/u
    );
    await expect(readdir(dir)).resolves.toStrictEqual([]);
  });
});

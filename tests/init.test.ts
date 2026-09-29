import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import packageJson from "../package.json";
import { ensureDocsDirIgnored, installSkill } from "../src/init.js";

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
    const files = await readdir(paths[0] ?? "");
    const skill = await readFile(
      path.join(paths[0] ?? "", "SKILL.md"),
      "utf-8"
    );
    expect({
      hasForceGuidance: skill.includes("--force"),
      hasSkillFiles: ["SKILL.md", "references"].every((file) =>
        files.includes(file)
      ),
      hasVersion: skill.includes(`MDXR version: ${packageJson.version}`),
      hasVersionCheck: skill.includes("Version check"),
      installPaths: paths,
    }).toStrictEqual({
      hasForceGuidance: true,
      hasSkillFiles: true,
      hasVersion: true,
      hasVersionCheck: true,
      installPaths: [path.join(dir, ".agents/skills/mdxr")],
    });
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

  it("removes stale files on --force reinstall", async () => {
    // fs.cp only overwrites same-named files — a file deleted or renamed
    // upstream would linger in dest after a forced reinstall.
    const dir = await makeDir();
    process.chdir(dir);
    const [dest] = await installSkill({ tool: "agents" });
    const stale = path.join(dest ?? "", "STALE.md");
    const skill = path.join(dest ?? "", "SKILL.md");
    const originalSkill = await readFile(skill, "utf-8");
    const outdatedSkill = originalSkill.replace(
      `MDXR version: ${packageJson.version}`,
      "MDXR version: 0.0.0-test"
    );
    expect(outdatedSkill).not.toBe(originalSkill);
    await writeFile(skill, outdatedSkill);
    await writeFile(stale, "leftover\n");
    await installSkill({ force: true, tool: "agents" });
    await expect(readdir(dest ?? "")).resolves.not.toContain("STALE.md");
    await expect(readdir(dest ?? "")).resolves.toContain("SKILL.md");
    await expect(readFile(skill, "utf-8")).resolves.toContain(
      `MDXR version: ${packageJson.version}`
    );
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

  it("does not touch .gitignore — that's the init command's job", async () => {
    const dir = await makeDir();
    process.chdir(dir);
    await installSkill({});
    await expect(readdir(dir)).resolves.not.toContain(".gitignore");
  });
});

describe(ensureDocsDirIgnored, () => {
  const tmpDirs: string[] = [];

  const makeDir = async (): Promise<string> => {
    const dir = await realpath(
      await mkdtemp(path.join(os.tmpdir(), "mdxr-ignore-"))
    );
    tmpDirs.push(dir);
    // The dev's own git config must not leak in: GIT_CONFIG_GLOBAL points at
    // a nonexistent file and HOME at the sandbox, so the global excludes
    // probe sees "unset" and falls back to <dir>/.config/git/ignore.
    process.env.GIT_CONFIG_GLOBAL = path.join(dir, "gitconfig");
    process.env.HOME = dir;
    process.env.USERPROFILE = dir;
    return dir;
  };

  afterEach(async () => {
    await Promise.all(
      tmpDirs.splice(0).map(async (d) => {
        await rm(d, { force: true, recursive: true });
      })
    );
  });

  it("creates .gitignore with .mdxr/ when missing", async () => {
    const dir = await makeDir();
    await expect(ensureDocsDirIgnored(dir)).resolves.toBe("added");
    await expect(readFile(path.join(dir, ".gitignore"), "utf-8")).resolves.toBe(
      ".mdxr/\n"
    );
  });

  it("appends to an existing .gitignore", async () => {
    const dir = await makeDir();
    await writeFile(path.join(dir, ".gitignore"), "node_modules/\ndist/\n");
    await expect(ensureDocsDirIgnored(dir)).resolves.toBe("added");
    await expect(readFile(path.join(dir, ".gitignore"), "utf-8")).resolves.toBe(
      "node_modules/\ndist/\n.mdxr/\n"
    );
  });

  it("separates the entry when .gitignore lacks a trailing newline", async () => {
    const dir = await makeDir();
    await writeFile(path.join(dir, ".gitignore"), "dist/");
    await ensureDocsDirIgnored(dir);
    await expect(readFile(path.join(dir, ".gitignore"), "utf-8")).resolves.toBe(
      "dist/\n.mdxr/\n"
    );
  });

  it("does not duplicate an existing .mdxr rule", async () => {
    await Promise.all(
      [".mdxr/", ".mdxr", "/.mdxr/", ".mdxr/**"].map(async (line) => {
        const dir = await makeDir();
        await writeFile(path.join(dir, ".gitignore"), `${line}\n`);
        await expect(ensureDocsDirIgnored(dir)).resolves.toBe("present");
        await expect(
          readFile(path.join(dir, ".gitignore"), "utf-8")
        ).resolves.toBe(`${line}\n`);
      })
    );
  });

  it("adds an active ignore rule when a later negation re-includes .mdxr", async () => {
    const rules = [".mdxr/\n!.mdxr/\n", ".mdxr/**\n!.mdxr/keep.md\n"];
    await Promise.all(
      rules.map(async (original) => {
        const dir = await makeDir();
        await writeFile(path.join(dir, ".gitignore"), original);

        await expect(ensureDocsDirIgnored(dir)).resolves.toBe("added");
        await expect(
          readFile(path.join(dir, ".gitignore"), "utf-8")
        ).resolves.toBe(`${original}.mdxr/\n`);
      })
    );
  });

  it("honors the last .mdxr rule when its negation appears first", async () => {
    const dir = await makeDir();
    const original = "!.mdxr/\n.mdxr/\n";
    await writeFile(path.join(dir, ".gitignore"), original);

    await expect(ensureDocsDirIgnored(dir)).resolves.toBe("present");
    await expect(readFile(path.join(dir, ".gitignore"), "utf-8")).resolves.toBe(
      original
    );
  });

  it("ignores commented-out .mdxr lines", async () => {
    const dir = await makeDir();
    await writeFile(path.join(dir, ".gitignore"), "# .mdxr/\n");
    await expect(ensureDocsDirIgnored(dir)).resolves.toBe("added");
    await expect(readFile(path.join(dir, ".gitignore"), "utf-8")).resolves.toBe(
      "# .mdxr/\n.mdxr/\n"
    );
  });

  it("skips the project .gitignore when the global excludes file covers .mdxr", async () => {
    const dir = await makeDir();
    // makeDir set HOME=dir, so the default excludes path lives here.
    await mkdir(path.join(dir, ".config", "git"), { recursive: true });
    await writeFile(path.join(dir, ".config", "git", "ignore"), ".mdxr/\n");

    await expect(ensureDocsDirIgnored(dir)).resolves.toBe("global");
    await expect(readdir(dir)).resolves.not.toContain(".gitignore");
  });

  it("honors a custom core.excludesFile from the global git config", async () => {
    const dir = await makeDir();
    const excludes = path.join(dir, "my-excludes");
    await writeFile(excludes, ".mdxr\n");
    await writeFile(
      path.join(dir, "gitconfig"),
      `[core]\n\texcludesFile = ${excludes}\n`
    );

    await expect(ensureDocsDirIgnored(dir)).resolves.toBe("global");
    await expect(readdir(dir)).resolves.not.toContain(".gitignore");
  });

  it("still writes .gitignore when the global excludes negates .mdxr", async () => {
    const dir = await makeDir();
    await mkdir(path.join(dir, ".config", "git"), { recursive: true });
    await writeFile(path.join(dir, ".config", "git", "ignore"), "!.mdxr/\n");

    await expect(ensureDocsDirIgnored(dir)).resolves.toBe("added");
    await expect(readFile(path.join(dir, ".gitignore"), "utf-8")).resolves.toBe(
      ".mdxr/\n"
    );
  });
});

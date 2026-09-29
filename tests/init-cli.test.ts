import { execFile } from "node:child_process";
import type { ExecFileException } from "node:child_process";
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
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import packageJson from "../package.json";

const cliPath = fileURLToPath(new URL("../dist/cli.mjs", import.meta.url));
// execFile has a custom promisify signature that preserves both output streams.
// oxlint-disable-next-line typescript/strict-void-return -- Use the custom promise API from node:child_process.
const execFileAsync = promisify(execFile);

interface Sandbox {
  codexHome: string;
  home: string;
  project: string;
  root: string;
}

interface CliResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

const runCli = async (args: string[], sandbox: Sandbox): Promise<CliResult> => {
  try {
    const { stderr, stdout } = await execFileAsync(
      process.execPath,
      [cliPath, "init", ...args],
      {
        cwd: sandbox.project,
        encoding: "utf-8",
        env: {
          ...process.env,
          CODEX_HOME: sandbox.codexHome,
          // Keep the real git config out: a dev machine with core.excludesFile
          // set would otherwise change what the CLI does under test.
          GIT_CONFIG_GLOBAL: path.join(sandbox.home, "gitconfig"),
          HOME: sandbox.home,
          USERPROFILE: sandbox.home,
        },
      }
    );
    return { exitCode: 0, stderr, stdout };
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }
    const cliError = error as ExecFileException;
    return {
      exitCode: typeof cliError.code === "number" ? cliError.code : 1,
      stderr: cliError.stderr ?? "",
      stdout: cliError.stdout ?? "",
    };
  }
};

describe("mdxr init CLI", () => {
  const sandboxes: string[] = [];

  const makeSandbox = async (): Promise<Sandbox> => {
    const root = await realpath(
      await mkdtemp(path.join(os.tmpdir(), "mdxr-init-cli-"))
    );
    const sandbox = {
      codexHome: path.join(root, "codex-home"),
      home: path.join(root, "home"),
      project: path.join(root, "project"),
      root,
    };
    await Promise.all([mkdir(sandbox.home), mkdir(sandbox.project)]);
    sandboxes.push(root);
    return sandbox;
  };

  afterEach(async () => {
    await Promise.all(
      sandboxes.splice(0).map(async (sandbox) => {
        await rm(sandbox, { force: true, recursive: true });
      })
    );
  });

  it("installs project instructions and ignores the docs scratch directory with --local", async () => {
    const sandbox = await makeSandbox();

    const result = await runCli(["--local"], sandbox);

    expect(result.exitCode).toBe(0);
    const installedFiles = await Promise.all([
      readFile(path.join(sandbox.project, "AGENTS.md"), "utf-8"),
      readFile(path.join(sandbox.project, "CLAUDE.md"), "utf-8"),
      readFile(path.join(sandbox.project, ".codex/MDXR.md"), "utf-8"),
      readFile(path.join(sandbox.project, ".claude/MDXR.md"), "utf-8"),
      readFile(path.join(sandbox.project, ".gitignore"), "utf-8"),
    ]);
    expect(installedFiles).toStrictEqual([
      expect.stringContaining("./.codex/MDXR.md"),
      expect.stringContaining("@./.claude/MDXR.md"),
      expect.stringContaining(`MDXR version: ${packageJson.version}`),
      expect.stringContaining(`MDXR version: ${packageJson.version}`),
      ".mdxr/\n",
    ]);
    await expect(readdir(sandbox.home)).resolves.toStrictEqual([]);
    await expect(readdir(sandbox.codexHome)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("skips .gitignore when the global git excludes file already covers .mdxr", async () => {
    const sandbox = await makeSandbox();
    // HOME is the sandbox, so git's default excludes path is under it.
    await mkdir(path.join(sandbox.home, ".config", "git"), {
      recursive: true,
    });
    await writeFile(
      path.join(sandbox.home, ".config", "git", "ignore"),
      ".mdxr/\n"
    );

    const result = await runCli(["--local"], sandbox);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("global git excludes");
    await expect(readdir(sandbox.project)).resolves.not.toContain(".gitignore");
  });

  it("keeps the legacy local default for --skill", async () => {
    const sandbox = await makeSandbox();

    const result = await runCli(["--skill"], sandbox);

    expect(result.exitCode).toBe(0);
    const installedFiles = await Promise.all([
      readFile(
        path.join(sandbox.project, ".agents/skills/mdxr/SKILL.md"),
        "utf-8"
      ),
      readFile(path.join(sandbox.project, ".gitignore"), "utf-8"),
    ]);
    expect(installedFiles).toStrictEqual([
      expect.stringContaining(`MDXR version: ${packageJson.version}`),
      ".mdxr/\n",
    ]);
    await expect(readdir(sandbox.home)).resolves.toStrictEqual([]);
    await expect(readdir(sandbox.codexHome)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("installs a versioned skill globally with --skill --global", async () => {
    const sandbox = await makeSandbox();

    const result = await runCli(["--skill", "--global"], sandbox);

    expect(result.exitCode).toBe(0);
    await expect(
      readFile(path.join(sandbox.home, ".agents/skills/mdxr/SKILL.md"), "utf-8")
    ).resolves.toContain(`MDXR version: ${packageJson.version}`);
    await expect(readdir(sandbox.project)).resolves.toStrictEqual([]);
    await expect(readdir(sandbox.codexHome)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects --global with --local before writing files", async () => {
    const sandbox = await makeSandbox();

    const result = await runCli(["--global", "--local"], sandbox);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain(
      "--global and --local cannot be used together"
    );
    await expect(readdir(sandbox.project)).resolves.toStrictEqual([]);
    await expect(readdir(sandbox.home)).resolves.toStrictEqual([]);
    await expect(readdir(sandbox.codexHome)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects an invalid --tool before writing files", async () => {
    const sandbox = await makeSandbox();

    const result = await runCli(["--local", "--tool", "bogus"], sandbox);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("unknown tool: bogus");
    await expect(readdir(sandbox.project)).resolves.toStrictEqual([]);
    await expect(readdir(sandbox.home)).resolves.toStrictEqual([]);
    await expect(readdir(sandbox.codexHome)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("defaults instructions to global and honors the temporary CODEX_HOME", async () => {
    const sandbox = await makeSandbox();

    const result = await runCli(["--tool", "codex"], sandbox);

    expect(result.exitCode).toBe(0);
    await expect(
      readFile(path.join(sandbox.codexHome, "AGENTS.md"), "utf-8")
    ).resolves.toContain(
      path.join(sandbox.codexHome, "MDXR.md").split(path.sep).join("/")
    );
    await expect(
      readFile(path.join(sandbox.codexHome, "MDXR.md"), "utf-8")
    ).resolves.toContain(`MDXR version: ${packageJson.version}`);
    await expect(readdir(sandbox.project)).resolves.toStrictEqual([]);
    await expect(readdir(sandbox.home)).resolves.toStrictEqual([]);
  });
});

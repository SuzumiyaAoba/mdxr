import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installInstructions } from "../src/instructions.js";

const exists = async (file: string): Promise<boolean> => {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

describe(installInstructions, () => {
  const tmpDirs: string[] = [];
  const originalCwd = process.cwd();
  const originalCodexHome = process.env.CODEX_HOME;
  let homeDir: string;

  const makeDir = async (): Promise<string> => {
    // realpath: process.cwd() resolves macOS's /var → /private/var symlink.
    const dir = await realpath(
      await mkdtemp(path.join(os.tmpdir(), "mdxr-instructions-"))
    );
    tmpDirs.push(dir);
    return dir;
  };

  beforeEach(async () => {
    homeDir = await makeDir();
    process.chdir(homeDir);
    vi.spyOn(os, "homedir").mockReturnValue(homeDir);
    delete process.env.CODEX_HOME;
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    vi.unstubAllEnvs();
    if (originalCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = originalCodexHome;
    }
    vi.restoreAllMocks();
    await Promise.all(
      tmpDirs.splice(0).map(async (dir) => {
        await rm(dir, { force: true, recursive: true });
      })
    );
  });

  it("installs global instructions for Claude and Codex by default", async () => {
    const installed = await installInstructions({});
    const claudeDir = path.join(homeDir, ".claude");
    const codexDir = path.join(homeDir, ".codex");
    const claude = installed.find(({ config }) => config.endsWith("CLAUDE.md"));
    const codex = installed.find(({ config }) => config.endsWith("AGENTS.md"));

    expect(installed).toStrictEqual([
      {
        config: path.join(claudeDir, "CLAUDE.md"),
        instructions: path.join(claudeDir, "MDXR.md"),
        status: "added",
      },
      {
        config: path.join(codexDir, "AGENTS.md"),
        instructions: path.join(codexDir, "MDXR.md"),
        status: "added",
      },
    ]);

    const claudeConfig = await readFile(claude?.config ?? "", "utf-8");
    const codexConfig = await readFile(codex?.config ?? "", "utf-8");
    const claudeInstructions = await readFile(
      claude?.instructions ?? "",
      "utf-8"
    );
    const codexInstructions = await readFile(
      codex?.instructions ?? "",
      "utf-8"
    );
    expect({
      claudeConfig,
      claudeHasInstructions: claudeInstructions.startsWith("# mdxr"),
      claudeReferencePath: claudeInstructions.includes(
        path
          .join(claudeDir, "mdxr/references/components.md")
          .split(path.sep)
          .join("/")
      ),
      codexHasConfigReference: codexConfig.includes(
        `Read and follow the mdxr instructions in \`${codexDir}/MDXR.md\``
      ),
      codexHasInstructions: codexInstructions.startsWith("# mdxr"),
      codexReferencePath: codexInstructions.includes(
        path
          .join(codexDir, "mdxr/references/components.md")
          .split(path.sep)
          .join("/")
      ),
    }).toStrictEqual({
      claudeConfig: "@./MDXR.md\n",
      claudeHasInstructions: true,
      claudeReferencePath: true,
      codexHasConfigReference: true,
      codexHasInstructions: true,
      codexReferencePath: true,
    });
  });

  it("installs only the selected global Codex instructions", async () => {
    const installed = await installInstructions({
      global: true,
      tool: "codex",
    });
    const codexDir = path.join(homeDir, ".codex");

    expect(installed).toStrictEqual([
      {
        config: path.join(codexDir, "AGENTS.md"),
        instructions: path.join(codexDir, "MDXR.md"),
        status: "added",
      },
    ]);
    await expect(exists(path.join(homeDir, ".claude"))).resolves.toBeFalsy();
  });

  it("installs only the selected global Claude instructions", async () => {
    const installed = await installInstructions({
      global: true,
      tool: "claude",
    });
    const claudeDir = path.join(homeDir, ".claude");

    expect(installed).toStrictEqual([
      {
        config: path.join(claudeDir, "CLAUDE.md"),
        instructions: path.join(claudeDir, "MDXR.md"),
        status: "added",
      },
    ]);
    await expect(exists(path.join(homeDir, ".codex"))).resolves.toBeFalsy();
  });

  it("uses CODEX_HOME for global Codex instructions", async () => {
    const codexHome = await makeDir();
    vi.stubEnv("CODEX_HOME", codexHome);

    const [installed] = await installInstructions({
      global: true,
      tool: "codex",
    });

    expect(installed?.config).toBe(path.join(codexHome, "AGENTS.md"));
    expect(installed?.instructions).toBe(path.join(codexHome, "MDXR.md"));
    await expect(
      exists(path.join(codexHome, "mdxr/references/components.md"))
    ).resolves.toBeTruthy();
    await expect(exists(path.join(homeDir, ".codex"))).resolves.toBeFalsy();
  });

  it("falls back to the mocked home when CODEX_HOME is empty", async () => {
    vi.stubEnv("CODEX_HOME", "");

    const [installed] = await installInstructions({ tool: "codex" });

    expect(installed?.config).toBe(path.join(homeDir, ".codex/AGENTS.md"));
    expect(installed?.instructions).toBe(path.join(homeDir, ".codex/MDXR.md"));
  });

  it("installs local root configs with imports and references relative to the project", async () => {
    const projectDir = await makeDir();
    process.chdir(projectDir);

    const installed = await installInstructions({ global: false });
    const claudeConfig = await readFile(
      path.join(projectDir, "CLAUDE.md"),
      "utf-8"
    );
    const codexConfig = await readFile(
      path.join(projectDir, "AGENTS.md"),
      "utf-8"
    );
    const claudeInstructions = await readFile(
      path.join(projectDir, ".claude/MDXR.md"),
      "utf-8"
    );
    const codexInstructions = await readFile(
      path.join(projectDir, ".codex/MDXR.md"),
      "utf-8"
    );

    expect(installed).toHaveLength(2);
    expect(claudeConfig).toBe("@./.claude/MDXR.md\n");
    expect(codexConfig).toContain("`./.codex/MDXR.md`");
    expect(claudeInstructions).toContain(
      ".claude/mdxr/references/components.md"
    );
    expect(codexInstructions).toContain(".codex/mdxr/references/components.md");
  });

  it("preserves an existing CRLF config body and its trailing newline", async () => {
    const codexDir = path.join(homeDir, ".codex");
    await mkdir(codexDir, { recursive: true });
    const config = path.join(codexDir, "AGENTS.md");
    const original = "# User config\r\nkeep this setting\r\n";
    await writeFile(config, original);

    await installInstructions({ global: true, tool: "codex" });

    const updatedConfig = await readFile(config, "utf-8");
    const entry = updatedConfig
      .split("\r\n")
      .find((line) => line.startsWith("Read and follow the mdxr instructions"));
    expect(updatedConfig).toBe(`${original}${entry}\r\n`);
  });

  it("uses a CRLF separator when the existing config has no trailing newline", async () => {
    const codexDir = path.join(homeDir, ".codex");
    await mkdir(codexDir, { recursive: true });
    const config = path.join(codexDir, "AGENTS.md");
    const original = "# User config\r\nkeep this setting";
    await writeFile(config, original);

    await installInstructions({ global: true, tool: "codex" });

    const updated = await readFile(config, "utf-8");
    expect(updated.startsWith(`${original}\r\n`)).toBeTruthy();
    expect(updated.endsWith("\r\n")).toBeTruthy();
  });

  it("does not duplicate config references when repeated", async () => {
    const [first] = await installInstructions({ global: true, tool: "claude" });
    const firstConfig = await readFile(first?.config ?? "", "utf-8");

    const [second] = await installInstructions({
      global: true,
      tool: "claude",
    });

    const updatedConfig = await readFile(second?.config ?? "", "utf-8");
    expect(second?.status).toBe("present");
    expect(updatedConfig).toBe(firstConfig);
    expect(
      updatedConfig.split(/\r?\n/u).filter((line) => line === "@./MDXR.md")
    ).toHaveLength(1);
  });

  it("preserves user config and removes stale references on force reinstall", async () => {
    const [initial] = await installInstructions({
      global: true,
      tool: "codex",
    });
    const codexDir = path.join(homeDir, ".codex");
    const referencesDir = path.join(codexDir, "mdxr/references");
    const originalConfig = await readFile(initial?.config ?? "", "utf-8");
    const staleReference = path.join(referencesDir, "stale.md");
    await writeFile(staleReference, "stale content\n");
    await writeFile(initial?.instructions ?? "", "user edit\n");

    const [reinstalled] = await installInstructions({
      force: true,
      global: true,
      tool: "codex",
    });

    expect(reinstalled?.status).toBe("present");
    await expect(readFile(reinstalled?.config ?? "", "utf-8")).resolves.toBe(
      originalConfig
    );
    await expect(
      readFile(reinstalled?.instructions ?? "", "utf-8")
    ).resolves.toMatch(/^# mdxr/u);
    await expect(exists(staleReference)).resolves.toBeFalsy();
    await expect(
      exists(path.join(referencesDir, "components.md"))
    ).resolves.toBeTruthy();
  });

  it("refuses a modified MDXR file before writing any other targets", async () => {
    const codexHome = await makeDir();
    vi.stubEnv("CODEX_HOME", codexHome);
    const existingInstructions = path.join(codexHome, "MDXR.md");
    await writeFile(existingInstructions, "user edits\n");

    await expect(installInstructions({ global: true })).rejects.toThrow(
      /already exists with different content/u
    );

    await expect(readFile(existingInstructions, "utf-8")).resolves.toBe(
      "user edits\n"
    );
    await expect(readdir(codexHome)).resolves.toStrictEqual(["MDXR.md"]);
    await expect(exists(path.join(homeDir, ".claude"))).resolves.toBeFalsy();
  });

  it.each(["toString", "constructor", "__proto__"])(
    "rejects prototype tool name %s without writing files",
    async (tool) => {
      const projectDir = await makeDir();
      process.chdir(projectDir);

      await expect(
        installInstructions({ global: false, tool })
      ).rejects.toThrow(/unknown tool/u);
      await expect(readdir(projectDir)).resolves.toStrictEqual([]);
    }
  );

  it("propagates errors while reading a config file", async () => {
    const projectDir = await makeDir();
    process.chdir(projectDir);
    await mkdir(path.join(projectDir, "AGENTS.md"));

    await expect(
      installInstructions({ global: false, tool: "codex" })
    ).rejects.toMatchObject({ code: "EISDIR" });
    await expect(readdir(projectDir)).resolves.toStrictEqual(["AGENTS.md"]);
  });
});

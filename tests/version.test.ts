import { execFile } from "node:child_process";
import type { ExecFileException } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
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
const syncScriptPath = fileURLToPath(
  new URL("../scripts/sync-skill-version.mjs", import.meta.url)
);
const skillPath = fileURLToPath(new URL("../skill/SKILL.md", import.meta.url));
// execFile has a custom promisify signature that preserves both output streams.
// oxlint-disable-next-line typescript/strict-void-return -- Use the custom promise API from node:child_process.
const execFileAsync = promisify(execFile);

interface CommandResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

const runNode = async (
  args: string[],
  cwd?: string
): Promise<CommandResult> => {
  try {
    const { stderr, stdout } = await execFileAsync(process.execPath, args, {
      cwd,
      encoding: "utf-8",
    });
    return { exitCode: 0, stderr, stdout };
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }
    const commandError = error as ExecFileException;
    return {
      exitCode: typeof commandError.code === "number" ? commandError.code : 1,
      stderr: commandError.stderr ?? "",
      stdout: commandError.stdout ?? "",
    };
  }
};

interface SyncFixture {
  packageFile: string;
  root: string;
  scriptFile: string;
  skillFile: string;
}

describe("mdxr version metadata", () => {
  const tempDirs: string[] = [];

  const makeSyncFixture = async (): Promise<SyncFixture> => {
    const root = await realpath(
      await mkdtemp(path.join(os.tmpdir(), "mdxr-skill-version-"))
    );
    const scriptsDir = path.join(root, "scripts");
    const skillDir = path.join(root, "skill");
    await Promise.all([
      mkdir(scriptsDir, { recursive: true }),
      mkdir(skillDir, { recursive: true }),
    ]);
    await Promise.all([
      copyFile(syncScriptPath, path.join(scriptsDir, "sync-skill-version.mjs")),
      copyFile(
        fileURLToPath(new URL("../package.json", import.meta.url)),
        path.join(root, "package.json")
      ),
      copyFile(skillPath, path.join(skillDir, "SKILL.md")),
    ]);
    tempDirs.push(root);
    return {
      packageFile: path.join(root, "package.json"),
      root,
      scriptFile: path.join(scriptsDir, "sync-skill-version.mjs"),
      skillFile: path.join(skillDir, "SKILL.md"),
    };
  };

  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await rm(dir, { force: true, recursive: true });
      })
    );
  });

  it.each(["--version", "-v"])(
    "prints the package version with %s",
    async (flag) => {
      const result = await runNode([cliPath, flag]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim().split(/\s/u)[0]).toBe(
        `mdxr/${packageJson.version}`
      );
    }
  );

  it("keeps the distributed skill version aligned with package.json", async () => {
    const skill = await readFile(skillPath, "utf-8");
    const versionMarkers = [
      ...skill.matchAll(/^MDXR version: (?<version>\S+)$/gmu),
    ];

    expect(versionMarkers).toHaveLength(1);
    expect(versionMarkers[0]?.groups?.version).toBe(packageJson.version);

    const result = await runNode([syncScriptPath, "--check"], os.tmpdir());
    expect(result.exitCode).toBe(0);
  });

  it("syncs a simulated package bump and checks mismatches without writing", async () => {
    const fixture = await makeSyncFixture();
    const bumpedVersion = "9.8.7-test";
    await writeFile(
      fixture.packageFile,
      `${JSON.stringify({ version: bumpedVersion }, null, 2)}\n`
    );
    const originalSkill = await readFile(fixture.skillFile, "utf-8");

    const cwdOutsideFixture = path.dirname(fixture.root);
    const mismatch = await runNode(
      [fixture.scriptFile, "--check"],
      cwdOutsideFixture
    );
    const skillAfterMismatch = await readFile(fixture.skillFile, "utf-8");

    const sync = await runNode([fixture.scriptFile], cwdOutsideFixture);
    const syncedSkill = await readFile(fixture.skillFile, "utf-8");
    const check = await runNode(
      [fixture.scriptFile, "--check"],
      cwdOutsideFixture
    );
    const skillAfterCheck = await readFile(fixture.skillFile, "utf-8");

    expect({
      bumpedVersionWritten: syncedSkill.includes(
        `MDXR version: ${bumpedVersion}`
      ),
      matchingCheckDidNotWrite: skillAfterCheck === syncedSkill,
      matchingCheckSucceeded: check.exitCode === 0,
      mismatchCheckDidNotWrite: skillAfterMismatch === originalSkill,
      mismatchRejected: mismatch.exitCode !== 0,
      mismatchReportsVersionsAndSyncCommand: [
        packageJson.version,
        bumpedVersion,
        "pnpm skill:sync",
      ].every((value) => mismatch.stderr.includes(value)),
      onlyVersionChanged:
        syncedSkill.replace(
          `MDXR version: ${bumpedVersion}`,
          `MDXR version: ${packageJson.version}`
        ) === originalSkill,
      syncSucceeded: sync.exitCode === 0,
    }).toStrictEqual({
      bumpedVersionWritten: true,
      matchingCheckDidNotWrite: true,
      matchingCheckSucceeded: true,
      mismatchCheckDidNotWrite: true,
      mismatchRejected: true,
      mismatchReportsVersionsAndSyncCommand: true,
      onlyVersionChanged: true,
      syncSucceeded: true,
    });
  });

  it("fails --check when the skill version marker is missing without writing", async () => {
    const fixture = await makeSyncFixture();
    const missingMarker = "# Skill without version metadata\n";
    await writeFile(fixture.skillFile, missingMarker);

    const result = await runNode(
      [fixture.scriptFile, "--check"],
      path.dirname(fixture.root)
    );

    expect(result.exitCode).not.toBe(0);
    await expect(readFile(fixture.skillFile, "utf-8")).resolves.toBe(
      missingMarker
    );
  });
});

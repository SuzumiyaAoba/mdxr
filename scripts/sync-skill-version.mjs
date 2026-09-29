// @ts-check

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const packagePath = path.resolve(projectRoot, "package.json");
const skillPath = path.resolve(projectRoot, "skill/SKILL.md");
const checkOnly = process.argv.slice(2).includes("--check");
const args = process.argv.slice(2);

if (args.some((argument) => argument !== "--check") || args.length > 1) {
  console.error("Usage: node scripts/sync-skill-version.mjs [--check]");
  process.exitCode = 2;
} else {
  try {
    /** @type {unknown} */
    const packageJson = JSON.parse(await readFile(packagePath, "utf-8"));

    if (
      typeof packageJson !== "object" ||
      packageJson === null ||
      !("version" in packageJson)
    ) {
      throw new Error("package.json must contain a non-empty version string.");
    }

    const { version } = packageJson;

    if (typeof version !== "string" || version.length === 0) {
      throw new Error("package.json must contain a non-empty version string.");
    }

    const skill = await readFile(skillPath, "utf-8");
    const versionLines = [...skill.matchAll(/^MDXR version:.*$/gmu)];

    if (versionLines.length !== 1) {
      throw new Error(
        `Expected exactly one "MDXR version: ..." marker in skill/SKILL.md; found ${versionLines.length}.`
      );
    }

    const [[currentLine]] = versionLines;
    const expectedLine = `MDXR version: ${version}`;

    if (currentLine === expectedLine) {
      console.log(`Skill version already matches package.json (${version}).`);
    } else if (checkOnly) {
      const currentVersion = currentLine.slice("MDXR version:".length).trim();
      const displayedVersion =
        currentVersion.length > 0 ? currentVersion : "(empty)";

      console.error(
        `Skill version is ${displayedVersion}, but package.json is ${version}. Run "pnpm skill:sync" to update it.`
      );
      process.exitCode = 1;
    } else {
      await writeFile(
        skillPath,
        skill.replace(/^MDXR version:.*$/mu, expectedLine),
        "utf-8"
      );
      console.log(`Updated skill version to ${version}.`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

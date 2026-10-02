import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// oxlint-disable-next-line typescript/strict-void-return -- Node's custom promisify signature.
const exec = promisify(execFile);
const cliPath = path.resolve("dist/cli.mjs");

describe("CLI stdout output", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "mdxr-output-cli-"));
    await writeFile(path.join(directory, "doc.mdx"), "# CLI stdout marker\n");
  });

  afterEach(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  it.each([
    ["render", "--out"],
    ["render", "-o"],
    ["text", "--out"],
    ["text", "-o"],
  ])("writes %s output to stdout with %s -", async (command, option) => {
    const args = [cliPath, command, "doc.mdx", option, "-"];
    if (command === "render") {
      args.push("--no-hydrate");
    }
    const { stdout } = await exec(process.execPath, args, { cwd: directory });
    expect(stdout).toContain("CLI stdout marker");
    expect(stdout).not.toContain("mdxr: wrote");
    const expectedOutput =
      command === "render" ? /^<!doctype html/u : /^# CLI stdout marker\n$/u;
    expect(stdout).toMatch(expectedOutput);
    await expect(readdir(directory)).resolves.toStrictEqual(["doc.mdx"]);
  });
});

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DocumentDiagnostic } from "../src/check-diagnostics.js";

// execFile's custom promise API preserves both stdout and stderr.
// oxlint-disable-next-line typescript/strict-void-return -- Use Node's custom promisify signature.
const exec = promisify(execFile);
const CLI = path.resolve("dist/cli.mjs");

describe("mdxr check CLI", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-check-cli-"));
  });

  afterEach(async () => {
    await rm(dir, { force: true, recursive: true });
  });

  it("prints warning diagnostics as JSON and succeeds without strict", async () => {
    const file = path.join(dir, "plan.mdx");
    await writeFile(file, '<Step sttaus="done" />');
    const { stdout } = await exec(process.execPath, [
      CLI,
      "check",
      file,
      "--format",
      "json",
    ]);

    const result: unknown = JSON.parse(stdout);
    expect(result).toMatchObject({
      diagnostics: [
        expect.objectContaining<Partial<DocumentDiagnostic>>({
          code: "mdxr:unknown-attribute",
          file,
          severity: "warning",
          suggestion: "status",
        }),
      ],
      errors: 0,
      ok: true,
      warnings: 1,
    });
  });

  it("returns a nonzero exit code for strict warnings and preserves structured diagnostics", async () => {
    const file = path.join(dir, "plan.mdx");
    await writeFile(file, '<Step sttaus="done" />');

    await expect(
      exec(process.execPath, [
        CLI,
        "check",
        file,
        "--strict",
        "--format",
        "json",
      ])
    ).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining('"ok":false') as unknown,
    });
  });

  it("reports errors in multiple files and provides readable text output", async () => {
    await writeFile(path.join(dir, "a.mdx"), "<Step");
    await writeFile(path.join(dir, "b.md"), '<Step status="wrong" />');

    await expect(
      exec(process.execPath, [CLI, "check", dir])
    ).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining(
        "checked 2 documents: 2 errors"
      ) as unknown,
    });
  });

  it("checks standard input using the current directory for relative paths", async () => {
    await writeFile(path.join(dir, "code.ts"), "const value = 1;\n");
    const execution = exec(
      process.execPath,
      [CLI, "check", "-", "--format", "json"],
      { cwd: dir }
    );
    execution.child.stdin?.end('<CodeFile path="code.ts" lines="1" />');
    const { stdout } = await execution;
    const result: unknown = JSON.parse(stdout);

    expect(result).toMatchObject({
      diagnostics: [],
      errors: 0,
      ok: true,
      warnings: 0,
    });
  });
});

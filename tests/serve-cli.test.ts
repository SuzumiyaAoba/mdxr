import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const cliPath = fileURLToPath(new URL("../dist/cli.mjs", import.meta.url));

describe("serve CLI input", () => {
  let directory: string;
  let child: ChildProcessWithoutNullStreams | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "mdxr-serve-cli-"));
  });

  afterEach(async () => {
    if (child !== undefined && child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    child = undefined;
    await rm(directory, { force: true, recursive: true });
  });

  const startCli = async (args: string[], source?: string): Promise<string> => {
    const previewProcess = spawn(
      process.execPath,
      [cliPath, "serve", "-p", "0", ...args],
      {
        cwd: directory,
        stdio: "pipe",
      }
    );
    child = previewProcess;
    let output = "";
    let errors = "";
    previewProcess.stderr.on("data", (chunk: Buffer) => {
      errors += chunk.toString();
    });
    if (source !== undefined) {
      previewProcess.stdin.end(source);
    }
    // oxlint-disable-next-line promise/avoid-new -- Wait for the CLI's startup log while rejecting early exits and timeouts.
    return await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`serve CLI did not start: ${errors}`));
      }, 20_000);
      previewProcess.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      previewProcess.on("exit", () => {
        clearTimeout(timeout);
        reject(new Error(`serve CLI exited before startup: ${errors}`));
      });
      previewProcess.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString();
        const url = /at (?<url>http:\/\/localhost:\d+)/u.exec(output)?.groups
          ?.url;
        if (url !== undefined) {
          clearTimeout(timeout);
          resolve(url);
        }
      });
    });
  };

  it("serves .mdxr with no argument even while stdin is still open", async () => {
    const url = await startCli([]);
    const response = await fetch(url);

    await expect(response.text()).resolves.toContain('id="mdxr-library-root"');
    const results = await fetch(`${url}/__mdxr_library/search`);
    await expect(results.json()).resolves.toMatchObject({ total: 0 });
  });

  it.each([["-"], ["--", "-"]])(
    "previews stdin only when explicitly requested with %j",
    async (...args) => {
      const url = await startCli(
        args,
        "# Explicit input\n\nStdin preview marker.\n"
      );
      const response = await fetch(url);
      const html = await response.text();

      expect(html).toContain("Stdin preview marker.");
      expect(html).not.toContain('id="mdxr-library-root"');
    }
  );
});

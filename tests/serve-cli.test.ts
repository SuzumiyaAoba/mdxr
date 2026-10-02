import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
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
    if (
      child !== undefined &&
      child.exitCode === null &&
      child.signalCode === null
    ) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    child = undefined;
    await rm(directory, { force: true, recursive: true });
  });

  const startCli = async (
    args: string[],
    source?: string,
    command = "serve"
  ): Promise<string> => {
    const previewProcess = spawn(
      process.execPath,
      [cliPath, command, "-p", "0", ...args],
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

  it.each(["serve", "library"])(
    "%s exits without a signal when no browser is connected",
    async (command) => {
      await startCli([directory, "--idle-timeout", "0.1"], undefined, command);
      if (child === undefined) {
        throw new Error("CLI did not start");
      }
      await expect(once(child, "exit")).resolves.toStrictEqual([0, null]);
    }
  );

  it.each(["SIGINT", "SIGTERM", "SIGHUP"] as const)(
    "%s closes the library, document watchers and live reload streams",
    async (signal) => {
      await writeFile(path.join(directory, "document.mdx"), "# Shutdown\n");
      const libraryUrl = await startCli([directory, "--idle-timeout", "0"]);
      const opened = await fetch(
        `${libraryUrl}/__mdxr_library/open/document.mdx`
      );
      await opened.text();
      const previewUrl = new URL(opened.url).origin;
      const controller = new AbortController();
      try {
        const events = await fetch(`${previewUrl}/__mdxr_events`, {
          signal: controller.signal,
        });
        expect(events.headers.get("content-type")).toBe("text/event-stream");
        if (child === undefined) {
          throw new Error("CLI did not start");
        }
        const exited = once(child, "exit");
        child.kill(signal);
        await expect(exited).resolves.toStrictEqual([0, null]);
        await expect(fetch(previewUrl)).rejects.toThrow("fetch failed");
        await expect(fetch(libraryUrl)).rejects.toThrow("fetch failed");
      } finally {
        controller.abort();
      }
    }
  );

  it("keeps stdin previews alive until their live reload connection closes", async () => {
    const url = await startCli(
      ["-", "--idle-timeout", "0.2"],
      "# Live reload\n"
    );
    const controller = new AbortController();
    try {
      const events = await fetch(`${url}/__mdxr_events`, {
        signal: controller.signal,
      });
      expect(events.status).toBe(200);
      await delay(500);
      if (child === undefined) {
        throw new Error("CLI did not start");
      }
      expect(child.exitCode).toBeNull();
      const exited = once(child, "exit");
      controller.abort();
      await expect(exited).resolves.toStrictEqual([0, null]);
    } finally {
      controller.abort();
    }
  });

  it.each(["-1", "Infinity", "2147484", "invalid"])(
    "rejects invalid --idle-timeout %s before starting a server",
    async (value) => {
      await expect(startCli([`--idle-timeout=${value}`])).rejects.toThrow(
        `invalid --idle-timeout: ${value}`
      );
    }
  );
});

import fs from "node:fs";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { watchDocuments } from "../src/check-watch.js";
import type { CheckResult } from "../src/check.js";

describe("project document watching", () => {
  let dir: string;
  let watcher: { close: () => void } | undefined;

  beforeEach(async () => {
    dir = await realpath(
      await mkdtemp(path.join(os.tmpdir(), "mdxr-check-watch-"))
    );
    await mkdir(path.join(dir, ".mdxr"));
    await writeFile(path.join(dir, ".mdxr", "doc.mdx"), "# Preview");
  });

  afterEach(async () => {
    watcher?.close();
    watcher = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
    await rm(dir, { force: true, recursive: true });
  });

  it("rechecks authored .mdxr documents but ignores history and session writes", async () => {
    const originalWatch = fs.watch.bind(fs);
    // Drive change notifications below without receiving delayed native events.
    const watch = vi
      .spyOn(fs, "watch")
      .mockImplementation((target) =>
        originalWatch(target, vi.fn<fs.WatchListener<string>>())
      );
    const onResult = vi.fn<(result: CheckResult) => void>();
    watcher = await watchDocuments(dir, {}, onResult);
    const listener = watch.mock.calls
      .find(
        ([target, options]) => target === dir && typeof options === "object"
      )
      ?.at(2);
    if (typeof listener !== "function") {
      throw new TypeError("Recursive document watcher was not installed");
    }
    vi.useFakeTimers();
    for (const ignored of [
      path.join(".mdxr", "history", "version.mdx"),
      path.join(".mdxr", "sessions.json"),
      path.join(".mdxr", ".sessions.lock"),
      path.join(".mdxr", ".sessions-update.tmp"),
    ]) {
      listener("change", ignored);
    }
    await vi.advanceTimersByTimeAsync(100);
    expect(onResult).toHaveBeenCalledOnce();

    listener("change", path.join(".mdxr", "doc.mdx"));
    await vi.advanceTimersByTimeAsync(100);
    vi.useRealTimers();
    await vi.waitFor(() => {
      expect(onResult).toHaveBeenCalledTimes(2);
    });
    expect(onResult.mock.calls[1]?.[0]).toMatchObject({
      files: [path.join(dir, ".mdxr", "doc.mdx")],
      ok: true,
    });
  });
});

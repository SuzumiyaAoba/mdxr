import { once } from "node:events";
import fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { renderFile } from "../src/render.js";
import { render } from "../src/render.js";
import { serveSource } from "../src/serve.js";

vi.mock(import("../src/render.js"), () => ({
  render: vi.fn<typeof render>(),
  renderFile: vi.fn<typeof renderFile>(),
}));

describe("preview watcher lifecycle", () => {
  let dir: string;
  let external: string;
  let server: Server | undefined;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-watch-"));
    external = await mkdtemp(path.join(os.tmpdir(), "mdxr-dep-"));
    vi.mocked(render).mockReset().mockResolvedValue("preview");
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (server?.listening === true) {
      server.close();
      await once(server, "close");
    }
    server = undefined;
    vi.restoreAllMocks();
    await rm(dir, { force: true, recursive: true });
    await rm(external, { force: true, recursive: true });
  });

  it("ignores cache/build events while still rebuilding for source edits", async () => {
    const watch = vi.spyOn(fs, "watch");
    server = await serveSource("# Preview", 0, { dir });
    const listener = watch.mock.calls[0]?.at(2);
    if (typeof listener !== "function") {
      throw new TypeError("recursive watcher was not installed");
    }
    vi.useFakeTimers();
    for (const ignored of [".mdxr-cache", ".git", "dist", "node_modules"]) {
      listener("change", path.join(ignored, "generated.js"));
    }
    await vi.advanceTimersByTimeAsync(100);
    expect(render).toHaveBeenCalledOnce();

    listener("change", "document.mdx");
    await vi.advanceTimersByTimeAsync(100);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("does not install dependency watchers after closing during a rebuild", async () => {
    const watch = vi.spyOn(fs, "watch");
    server = await serveSource("# Preview", 0, { dir });
    const listener = watch.mock.calls[0]?.at(2);
    if (typeof listener !== "function") {
      throw new TypeError("recursive watcher was not installed");
    }
    const completion = new EventTarget();
    vi.mocked(render).mockImplementationOnce(async (_source, opts) => {
      opts?.onDependencies?.([path.join(external, "theme.css")]);
      await once(completion, "finish");
      return "updated preview";
    });

    vi.useFakeTimers();
    listener("change", "document.mdx");
    await vi.advanceTimersByTimeAsync(100);
    expect(render).toHaveBeenCalledTimes(2);
    server.close();
    await once(server, "close");
    completion.dispatchEvent(new Event("finish"));
    await vi.advanceTimersByTimeAsync(0);
    try {
      expect(watch).toHaveBeenCalledOnce();
    } finally {
      for (const result of watch.mock.results) {
        if (result.type === "return") {
          result.value.close();
        }
      }
    }
  });

  it("queues source edits behind the initial render", async () => {
    const watch = vi.spyOn(fs, "watch");
    const completion = new EventTarget();
    vi.mocked(render).mockImplementationOnce(async () => {
      await once(completion, "finish");
      return "initial preview";
    });
    const startup = serveSource("# Preview", 0, { dir });
    const listener = watch.mock.calls[0]?.at(2);
    if (typeof listener !== "function") {
      throw new TypeError("recursive watcher was not installed");
    }
    vi.useFakeTimers();
    listener("change", "document.mdx");
    await vi.advanceTimersByTimeAsync(100);
    const rendersDuringStartup = vi.mocked(render).mock.calls.length;
    completion.dispatchEvent(new Event("finish"));
    server = await startup;
    await vi.advanceTimersByTimeAsync(0);
    expect(rendersDuringStartup).toBe(1);
    expect(render).toHaveBeenCalledTimes(2);
  });
});

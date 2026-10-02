import { once } from "node:events";
import fs from "node:fs";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isRecord } from "../src/guards.js";
import { createPreviewWatcher } from "../src/preview-watch.js";
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

  it("ignores delayed startup and duplicate events without losing actual edits", async () => {
    const file = path.join(dir, "document.mdx");
    const dependency = path.join(dir, "part.md");
    await writeFile(file, "# Initial\n");
    await writeFile(dependency, "Initial dependency\n");
    const watch = vi.spyOn(fs, "watch");
    const onChange = vi.fn<() => void>();
    const watcher = createPreviewWatcher(
      { watchDir: dir, watchFile: file },
      onChange
    );
    try {
      const listener = watch.mock.calls[0]?.at(2);
      if (typeof listener !== "function") {
        throw new TypeError("recursive watcher was not installed");
      }
      vi.useFakeTimers();
      listener("change", path.basename(dir));
      listener("rename", path.basename(dir));
      listener("rename", "document.mdx");
      listener("rename", "part.md");
      await vi.advanceTimersByTimeAsync(100);
      expect(onChange).not.toHaveBeenCalled();
      watcher.armDependencies([await realpath(dependency)]);

      await writeFile(file, "# Updated\n");
      listener("change", "document.mdx");
      listener("rename", "document.mdx");
      await vi.advanceTimersByTimeAsync(100);
      expect(onChange).toHaveBeenCalledOnce();

      await writeFile(dependency, "Updated dependency\n");
      listener("change", "part.md");
      await vi.advanceTimersByTimeAsync(100);
      expect(onChange).toHaveBeenCalledTimes(2);

      // A real child with the directory's name must still trigger reloads.
      const sameNameChild = path.join(dir, path.basename(dir));
      await writeFile(sameNameChild, "Child content");
      listener("rename", path.basename(dir));
      await vi.advanceTimersByTimeAsync(100);
      expect(onChange).toHaveBeenCalledTimes(3);
      await rm(sameNameChild);
      listener("rename", path.basename(dir));
      await vi.advanceTimersByTimeAsync(100);
      expect(onChange).toHaveBeenCalledTimes(4);
    } finally {
      watcher.close();
    }
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
    // Recursive fs.watch is native on darwin/win32 but emulated on other
    // platforms, where the emulator itself calls fs.watch per directory —
    // so assert no *new* watchers instead of a fixed call count.
    const callsBeforeClose = watch.mock.calls.length;
    server.close();
    await once(server, "close");
    completion.dispatchEvent(new Event("finish"));
    await vi.advanceTimersByTimeAsync(0);
    try {
      expect(watch).toHaveBeenCalledTimes(callsBeforeClose);
    } finally {
      for (const result of watch.mock.results) {
        if (result.type === "return") {
          result.value.close();
        }
      }
    }
  });

  it("rebuilds when a tracked document under .mdxr changes", async () => {
    const watch = vi.spyOn(fs, "watch");
    const canonicalDir = await realpath(dir);
    const included = path.join(canonicalDir, ".mdxr", "included.mdx");
    await mkdir(path.dirname(included));
    await writeFile(included, "Initial dependency");
    vi.mocked(render).mockImplementation(async (_source, opts) => {
      opts?.onDependencies?.([
        path.join(canonicalDir, ".mdxr", "included.mdx"),
      ]);
      return await Promise.resolve("preview");
    });
    server = await serveSource("# Preview", 0, { dir });
    const listener = watch.mock.calls[0]?.at(2);
    if (typeof listener !== "function") {
      throw new TypeError("Recursive document watcher was not installed");
    }
    vi.useFakeTimers();
    await writeFile(included, "Updated dependency");
    listener("change", path.join(".mdxr", "included.mdx"));
    await vi.advanceTimersByTimeAsync(100);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("resolves external events from their watched directory when basenames match", async () => {
    const source = path.join(dir, "document.mdx");
    const dependency = path.join(external, "document.mdx");
    await writeFile(source, "# Source\n");
    await writeFile(dependency, "# Dependency\n");
    const watch = vi.spyOn(fs, "watch");
    const onChange = vi.fn<() => void>();
    const watcher = createPreviewWatcher(
      { watchDir: dir, watchFile: source },
      onChange
    );
    try {
      watcher.armDependencies([dependency]);
      const listener = watch.mock.calls.find(
        ([directory, options]) =>
          directory === external && typeof options === "function"
      )?.[1];
      if (typeof listener !== "function") {
        throw new TypeError("external dependency watcher was not installed");
      }
      vi.useFakeTimers();
      await writeFile(dependency, "# Updated dependency\n");
      listener("change", "document.mdx");
      await vi.advanceTimersByTimeAsync(100);
      expect(onChange).toHaveBeenCalledOnce();
    } finally {
      watcher.close();
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

  it("queues source edits behind an in-flight diagnostic recheck", async () => {
    const watch = vi.spyOn(fs, "watch");
    server = await serveSource("# Preview", 0, { dir });
    const listener = watch.mock.calls[0]?.at(2);
    const address = server.address();
    if (
      typeof listener !== "function" ||
      typeof address !== "object" ||
      address === null
    ) {
      throw new Error("preview server or watcher was not started");
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const completion = new EventTarget();
    vi.mocked(render)
      .mockImplementationOnce(async () => {
        await once(completion, "finish");
        return "rechecked preview";
      })
      .mockResolvedValueOnce("updated source preview");

    const recheck = fetch(`${baseUrl}/__doc_diagnostics`, { method: "POST" });
    try {
      await vi.waitFor(() => {
        expect(render).toHaveBeenCalledTimes(2);
      });
      vi.useFakeTimers();
      listener("change", "document.mdx");
      await vi.advanceTimersByTimeAsync(100);
      expect(render).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
      completion.dispatchEvent(new Event("finish"));
      await recheck;
    }

    await vi.waitFor(() => {
      expect(render).toHaveBeenCalledTimes(3);
    });
    const response = await fetch(baseUrl);
    await expect(response.text()).resolves.toBe("updated source preview");
  });

  it("cancels a pending rebuild when the preview closes", async () => {
    const watch = vi.spyOn(fs, "watch");
    server = await serveSource("# Preview", 0, { dir });
    const listener = watch.mock.calls[0]?.at(2);
    if (typeof listener !== "function") {
      throw new TypeError("recursive watcher was not installed");
    }

    vi.useFakeTimers();
    listener("change", "document.mdx");
    await vi.advanceTimersByTimeAsync(40);
    server.close();
    await once(server, "close");
    await vi.advanceTimersByTimeAsync(100);

    expect(render).toHaveBeenCalledOnce();
  });

  it("re-arms fallback directories and watches external dependencies only once", async () => {
    const components = path.join(dir, "components");
    const history = path.join(dir, ".mdxr", "history");
    const modules = path.join(dir, "node_modules");
    await Promise.all([
      mkdir(components),
      mkdir(history, { recursive: true }),
      mkdir(modules),
    ]);
    const originalWatch = fs.watch.bind(fs);
    const watch = vi.spyOn(fs, "watch").mockImplementation((...args) => {
      const [, options] = args;
      if (isRecord(options) && options.recursive === true) {
        throw new Error("Recursive watching is unavailable");
      }
      return originalWatch(...args);
    });
    vi.mocked(render).mockImplementation(async (_source, opts) => {
      opts?.onDependencies?.([
        path.join(external, "theme.css"),
        path.join(external, "tokens.css"),
        path.join(components, "theme.css"),
        path.join(external, "node_modules", "theme", "index.css"),
      ]);
      return await Promise.resolve("preview");
    });

    server = await serveSource("# Preview", 0, { dir });
    const listener = watch.mock.calls.find(
      ([directory, options]) =>
        directory === dir && typeof options === "function"
    )?.[1];
    if (typeof listener !== "function") {
      throw new TypeError("fallback directory watcher was not installed");
    }

    const added = path.join(dir, "added");
    await mkdir(added);
    vi.useFakeTimers();
    listener("rename", "added");
    await vi.advanceTimersByTimeAsync(100);

    const flatDirectories = watch.mock.calls
      .filter(([, options]) => typeof options === "function")
      .map(([directory]) => directory);
    expect(flatDirectories).toStrictEqual(
      expect.arrayContaining([components, added])
    );
    expect(
      flatDirectories.filter((directory) => directory === external)
    ).toHaveLength(1);
    expect(flatDirectories).not.toContain(history);
    expect(flatDirectories).not.toContain(modules);
    expect(flatDirectories).not.toContain(
      path.join(external, "node_modules", "theme")
    );
  });

  it.each(["project", "library"])(
    "watches authored history directories and session files from a %s root",
    async (root) => {
      const library = path.join(dir, ".mdxr");
      const watchDir = root === "project" ? dir : library;
      const authoredHistory = path.join(
        library,
        "report",
        "history",
        "part.md"
      );
      const authoredSessions = path.join(library, "report", "sessions.json");
      const internalHistory = path.join(library, "history", "version.mdx");
      const internalSessions = path.join(library, "sessions.json");
      for (const file of [
        authoredHistory,
        authoredSessions,
        internalHistory,
        internalSessions,
      ]) {
        // oxlint-disable-next-line no-await-in-loop
        await mkdir(path.dirname(file), { recursive: true });
        // oxlint-disable-next-line no-await-in-loop
        await writeFile(file, "Initial content");
      }
      const originalWatch = fs.watch.bind(fs);
      const watch = vi
        .spyOn(fs, "watch")
        .mockImplementation((target) =>
          originalWatch(target, vi.fn<fs.WatchListener<string>>())
        );
      const onChange = vi.fn<() => void>();
      const watcher = createPreviewWatcher(
        { includeMdxrDocuments: true, watchDir },
        onChange
      );
      try {
        const listener = watch.mock.calls[0]?.at(2);
        if (typeof listener !== "function") {
          throw new TypeError("recursive watcher was not installed");
        }
        watcher.armDependencies([authoredHistory, authoredSessions]);
        vi.useFakeTimers();
        for (const file of [internalHistory, internalSessions]) {
          // oxlint-disable-next-line no-await-in-loop
          await writeFile(file, "Internal change");
          listener("change", path.relative(watchDir, file));
        }
        await vi.advanceTimersByTimeAsync(100);
        expect(onChange).not.toHaveBeenCalled();

        await writeFile(authoredHistory, "Updated document");
        listener("change", path.relative(watchDir, authoredHistory));
        await vi.advanceTimersByTimeAsync(100);
        expect(onChange).toHaveBeenCalledOnce();

        await writeFile(authoredSessions, "Updated code sample");
        listener("change", path.relative(watchDir, authoredSessions));
        await vi.advanceTimersByTimeAsync(100);
        expect(onChange).toHaveBeenCalledTimes(2);
      } finally {
        watcher.close();
      }
    }
  );
});

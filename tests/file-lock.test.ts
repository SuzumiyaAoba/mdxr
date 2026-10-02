import fs from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { acquireFileLock } from "../src/file-lock.js";

describe("file lock recovery", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "mdxr-lock-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(dir, { force: true, recursive: true });
  });

  it("closes and removes an acquired lock if its initialization fails", async () => {
    const lockPath = path.join(dir, ".lock");
    const originalOpen = fs.open.bind(fs);
    const failure = new Error("Could not write lock metadata");
    let acquired: FileHandle | undefined;
    const closed = vi.fn<() => void>();
    vi.spyOn(fs, "open").mockImplementationOnce(async (file, flags, mode) => {
      const handle = await originalOpen(file, flags, mode);
      acquired = handle;
      const originalClose = handle.close.bind(handle);
      vi.spyOn(handle, "close").mockImplementation(async () => {
        await originalClose();
        closed();
      });
      vi.spyOn(handle, "writeFile").mockRejectedValueOnce(failure);
      return handle;
    });
    try {
      await expect(acquireFileLock(lockPath, "test")).rejects.toBe(failure);
      expect(closed).toHaveBeenCalledOnce();
      await expect(fs.stat(lockPath)).rejects.toMatchObject({ code: "ENOENT" });

      const release = await acquireFileLock(lockPath, "test");
      await release();
      await expect(fs.stat(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await acquired?.close();
    }
  });

  it("removes the lock even if closing its handle reports an error", async () => {
    const lockPath = path.join(dir, ".lock");
    const originalOpen = fs.open.bind(fs);
    const failure = new Error("Could not close lock handle");
    vi.spyOn(fs, "open").mockImplementationOnce(async (file, flags, mode) => {
      const handle = await originalOpen(file, flags, mode);
      const originalClose = handle.close.bind(handle);
      vi.spyOn(handle, "close").mockImplementationOnce(async () => {
        await originalClose();
        throw failure;
      });
      return handle;
    });

    const release = await acquireFileLock(lockPath, "test");
    await expect(release()).rejects.toBe(failure);
    await expect(fs.stat(lockPath)).rejects.toMatchObject({ code: "ENOENT" });
    const releaseNext = await acquireFileLock(lockPath, "test");
    await releaseNext();
  });
});

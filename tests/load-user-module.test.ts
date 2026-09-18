import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import {
  importBundledCode,
  resolveModuleEntry,
} from "../src/load-user-module.js";
import { cacheDir } from "../src/paths.js";

describe(importBundledCode, () => {
  it("imports bundled ESM code and exposes its exports", async () => {
    const mod = await importBundledCode(
      'export const answer = 42; export default "ok";',
      "importtest"
    );
    expect(mod.answer).toBe(42);
    expect(mod.default).toBe("ok");
  });

  it("prunes stale cache files beyond the keep count", async () => {
    await Promise.all(
      Array.from({ length: 12 }, async (_, i) => {
        await importBundledCode(`export const n${i} = ${i};`, "prunetest");
      })
    );
    // Backdate most files past the staleness guard so prune can remove them.
    const old = new Date(Date.now() - 60_000);
    const ents = await readdir(cacheDir);
    await Promise.all(
      ents
        .filter((f) => f.startsWith("prunetest-"))
        .slice(6)
        .map(async (f) => {
          await utimes(path.join(cacheDir, f), old, old);
        })
    );
    await importBundledCode('export const trigger = "prune";', "prunetest");
    // pruneCache is fire-and-forget after each import.
    await expect
      .poll(
        async () => {
          const files = await readdir(cacheDir);
          return files.filter((f) => f.startsWith("prunetest-")).length;
        },
        { timeout: 3000 }
      )
      .toBeLessThanOrEqual(8);
  });
});

describe(resolveModuleEntry, () => {
  const tmpDirs: string[] = [];

  afterAll(async () => {
    await Promise.all(
      tmpDirs.map(async (d) => {
        await rm(d, { force: true, recursive: true });
      })
    );
  });

  it("returns the path unchanged for files and missing paths", () => {
    expect(resolveModuleEntry("/no/such/file.tsx")).toBe("/no/such/file.tsx");
  });

  it("collapses a directory to its index file", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-load-"));
    tmpDirs.push(dir);
    const sub = path.join(dir, "components");
    await mkdir(sub);
    expect(resolveModuleEntry(sub)).toBe(sub);
    const index = path.join(sub, "index.tsx");
    await writeFile(index, "export {};\n");
    expect(resolveModuleEntry(sub)).toBe(index);
  });
});

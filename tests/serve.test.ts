import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { serveSource } from "../src/serve.js";

describe(serveSource, () => {
  const tmpDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tmpDirs.map(async (d) => {
        await rm(d, { force: true, recursive: true });
      })
    );
    tmpDirs.length = 0;
  });

  it("binds the preview server to loopback only", async () => {
    // The startup log says localhost — binding 0.0.0.0 would expose the
    // unauthenticated document (and its editor links) to the LAN.
    const dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-serve-"));
    tmpDirs.push(dir);
    const server = await serveSource("# hi\n", 0, { dir });
    try {
      const address = server.address();
      expect(address).toMatchObject({ address: "127.0.0.1" });
      expect(
        typeof address === "object" && address !== null && address.port > 0
      ).toBeTruthy();
    } finally {
      server.close();
    }
  });
});

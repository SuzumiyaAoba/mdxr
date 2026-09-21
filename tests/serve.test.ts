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

  it("honors hydrate: false while retaining live reload", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-serve-"));
    tmpDirs.push(dir);
    const server = await serveSource('<Switch aria-label="Enabled" />', 0, {
      dir,
      hydrate: false,
    });
    try {
      const address = server.address();
      if (typeof address !== "object" || address === null) {
        throw new Error("server is not listening");
      }
      const res = await fetch(`http://127.0.0.1:${address.port}/`);
      const html = await res.text();
      expect(html).toContain('role="switch"');
      expect(html).toContain("/__mdxr_events");
      expect(html.includes("hydrateRoot")).toBeFalsy();
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });
});

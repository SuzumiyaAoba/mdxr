import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";

import { chromium } from "playwright";
import type { Browser } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { serveLibrary } from "../src/library.js";
import { serveSource } from "../src/serve.js";

const IMAGE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+c8L8AAAAASUVORK5CYII=",
  "base64"
);
const dirs: string[] = [];
const servers: Server[] = [];

const makeDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-serve-images-"));
  dirs.push(dir);
  return dir;
};

const serverUrl = (server: Server): string => {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Preview server did not start");
  }
  return `http://127.0.0.1:${address.port}`;
};

describe("local images in live previews", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(async (server) => {
        const closed = once(server, "close");
        server.closeAllConnections();
        server.close();
        await closed;
      })
    );
    await Promise.all(
      dirs.splice(0).map(async (dir) => {
        await rm(dir, { force: true, recursive: true });
      })
    );
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("loads document-relative Markdown and Figure images opened from a nested library path", async () => {
    const root = await makeDir();
    const id = "20260930180000-画像の確認/index.mdx";
    const dir = path.join(root, path.dirname(id));
    await mkdir(path.join(dir, "assets"), { recursive: true });
    await writeFile(path.join(dir, "assets/画像 photo.png"), IMAGE);
    await writeFile(
      path.join(root, id),
      [
        "# Local images",
        "![Markdown image](assets/%E7%94%BB%E5%83%8F%20photo.png)",
        '<Figure src="assets/画像 photo.png" alt="Figure image" />',
      ].join("\n\n")
    );
    const server = await serveLibrary(root, 0);
    servers.push(server);
    const page = await browser.newPage();
    try {
      await page.goto(
        `${serverUrl(server)}/__doc_library/open/${encodeURIComponent(id)}`
      );
      expect(decodeURIComponent(new URL(page.url()).pathname)).toBe(`/${id}`);
      for (const alt of ["Markdown image", "Figure image"]) {
        const image = page.getByRole("img", { exact: true, name: alt });
        // Each image must decode successfully in the browser, including after hydration.
        // oxlint-disable-next-line no-await-in-loop
        await expect
          .poll(
            async () =>
              await image.evaluate((element: HTMLImageElement) =>
                element.complete ? element.naturalWidth : 0
              )
          )
          .toBe(1);
      }
    } finally {
      await page.close();
    }
  });

  it("loads relative images in stdin previews using the requested directory", async () => {
    const dir = await makeDir();
    await writeFile(path.join(dir, "pixel.png"), IMAGE);
    const server = await serveSource("![Stdin image](pixel.png)", 0, { dir });
    servers.push(server);
    const page = await browser.newPage();
    try {
      await page.goto(serverUrl(server));
      const image = page.getByRole("img", { exact: true, name: "Stdin image" });
      await expect
        .poll(
          async () =>
            await image.evaluate((element: HTMLImageElement) =>
              element.complete ? element.naturalWidth : 0
            )
        )
        .toBe(1);
    } finally {
      await page.close();
    }
  });
});

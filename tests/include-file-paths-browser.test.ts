import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { chromium } from "playwright";
import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { editorUrl } from "../src/editor.js";
import { render } from "../src/render.js";

describe("included code header links in a browser", () => {
  let browser: Browser;
  let dir: string;

  beforeAll(async () => {
    browser = await chromium.launch();
    dir = await realpath(
      await mkdtemp(path.join(os.tmpdir(), "mdxr-include-code-browser-"))
    );
    await mkdir(path.join(dir, "chapters", "src"), { recursive: true });
    await mkdir(path.join(dir, "src"));
    await writeFile(path.join(dir, "src", "sample.ts"), "ROOT_FILE\n");
    await writeFile(
      path.join(dir, "chapters", "src", "sample.ts"),
      "INCLUDED_FILE\n"
    );
    await writeFile(
      path.join(dir, "chapters", "part.mdx"),
      '```ts title="src/sample.ts:2-4"\nconst value = 1;\n```\n'
    );
  });

  afterAll(async () => {
    await browser?.close();
    if (dir !== undefined) {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it.each([false, true])(
    "keeps the included file link and authored label (hydrate=%s)",
    async (hydrate) => {
      const html = await render('<Include path="chapters/part.mdx" />', {
        dir,
        filePath: "index.mdx",
        hydrate,
      });
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => {
        errors.push(error.message);
      });
      page.on("console", (message) => {
        if (message.type() === "error") {
          errors.push(message.text());
        }
      });
      try {
        await page.setContent(
          html.replace(
            "<head>",
            '<head><script>document.addEventListener("mdxr:hydrated", () => { document.documentElement.dataset.auditHydrated = "true"; });</script>'
          )
        );
        if (hydrate) {
          await page.waitForFunction(
            () => document.documentElement.dataset.auditHydrated === "true"
          );
        }
        const link = page
          .locator("#mdxr-root a")
          .filter({ hasText: "src/sample.ts:2-4" });
        await expect(link.getAttribute("href")).resolves.toBe(
          editorUrl(
            undefined,
            path.join(dir, "chapters", "src", "sample.ts"),
            "2"
          )
        );
        expect(errors).toStrictEqual([]);
      } finally {
        await page.close();
      }
    }
  );
});

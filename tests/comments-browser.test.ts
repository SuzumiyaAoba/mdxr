import { chromium } from "playwright";
import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { render } from "../src/render.js";

const CODE =
  '<Comments>\n\n```ts\nconst a = 1;\nconst b = 2;\n```\n\n<Comment lines="1" author="Ada">Original note</Comment>\n\n</Comments>';

describe("comment template hydration and interactions", () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
  });

  it.each([false, true])(
    "adds and exports comments without recreating the document (hydrate: %s)",
    async (hydrate) => {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => {
        errors.push(error.message);
      });
      try {
        await page.setContent(await render(CODE, { hydrate }));
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => {
          Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
              writeText: (value: string) => {
                document.documentElement.dataset.copied = value;
              },
            },
          });
        });
        await page
          .getByRole("button", { name: "Add a comment on line 2" })
          .click();
        await page
          .getByRole("textbox", { name: "Comment text" })
          .fill("New note");
        await page
          .getByRole("button", { exact: true, name: "Comment" })
          .click();
        await page
          .getByRole("button", { exact: true, name: "Reply" })
          .first()
          .click();
        await page
          .getByRole("textbox", { name: "Comment text" })
          .fill("Reply note");
        await page
          .getByRole("button", { exact: true, name: "Comment" })
          .click();
        await page
          .getByRole("button", { exact: true, name: "Copy markdown" })
          .click();
        const markdown = await page.locator("html").getAttribute("data-copied");
        expect(markdown).toContain("Original note");
        expect(markdown).toContain("New note");
        expect(markdown).toContain("Reply note");
        expect(markdown?.match(/<Comment(?=\s|>)/gu)).toHaveLength(3);
        expect(errors).toStrictEqual([]);
      } finally {
        await page.close();
      }
    }
  );
});

import { chromium } from "playwright";
import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { render } from "../src/render.js";

describe("chart layout in a browser", () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
  });

  it.each([false, true])(
    "fills the treemap and hydrates fractional charts (hydrate: %s)",
    async (hydrate) => {
      const page = await browser.newPage({
        viewport: { height: 844, width: 390 },
      });
      const errors: string[] = [];
      page.on("pageerror", (error) => {
        errors.push(error.message);
      });
      page.on("console", (message) => {
        if (
          /hydration|hydrating|Minified React error|NaN|same key/iu.test(
            message.text()
          )
        ) {
          errors.push(message.text());
        }
      });
      try {
        await page.setContent(
          await render(
            `<Treemap><Tile name="Everything" value="1" /></Treemap>
<LineChart min="0" max=".001"><Series name="Small" values=".00025 .0005 .001" /></LineChart>
<Scatter><Point x="1" y="1" size="-5" /><Point x="2" y="2" size="5" /></Scatter>`,
            { hydrate }
          )
        );
        const tile = page.getByTitle("Everything · 1 (100%)");
        const geometry = await tile.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const canvas = element.parentElement?.getBoundingClientRect();
          return {
            canvasHeight: canvas?.height,
            canvasWidth: canvas?.width,
            height: box.height,
            width: box.width,
          };
        });
        expect(geometry.height).toBeGreaterThan(0);
        expect(geometry.height).toBeCloseTo(geometry.canvasHeight ?? 0);
        expect(geometry.width).toBeCloseTo(geometry.canvasWidth ?? 0);
        await expect(
          page.locator("svg text").allTextContents()
        ).resolves.toContain("0.00025");
        expect(errors).toStrictEqual([]);
      } finally {
        await page.close();
      }
    }
  );
});

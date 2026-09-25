import { chromium } from "playwright";
import { describe, expect, it } from "vitest";

import { render } from "../src/render.js";
import { renderDoc } from "./helpers.js";

const GRAPH = `<Graph title="Runtime" direction="right" minScale="0.5">
  <Node id="ui" label="Application interface" href="https://example.com/interface" />
  <Node id="session" label="Session service" />
  <Node id="core" label="Independent execution core" />
  <Node id="tools" label="Tool execution boundary" />
  <Edge from="ui" to="session" />
  <Edge from="session" to="core" />
  <Edge from="core" to="tools" />
</Graph>`;

describe("graph viewport", () => {
  it("fits and restores actual size using the keyboard, without JavaScript", async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        javaScriptEnabled: false,
        viewport: { height: 900, width: 900 },
      });
      await page.setContent(await render(GRAPH, { hydrate: false }));
      const image = page.locator(".mdxr-graph-image");
      const intrinsic = Number(await image.getAttribute("width"));
      const fitted = await image.boundingBox();
      expect(fitted?.width).toBeLessThan(intrinsic);
      expect(fitted?.width).toBeGreaterThanOrEqual(intrinsic * 0.5);
      await expect(
        page
          .getByRole("link", { name: "Application interface" })
          .getAttribute("href")
      ).resolves.toBe("https://example.com/interface");
      const control = page.getByRole("checkbox", { name: "Actual size" });
      await control.focus();
      await page.keyboard.press("Space");
      await expect(control.isChecked()).resolves.toBeTruthy();
      const original = await image.boundingBox();
      expect(original?.width).toBeCloseTo(intrinsic, 0);
    } finally {
      await browser.close();
    }
  });

  it("keeps mobile text readable and prints an expanded graph without clipping", async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        javaScriptEnabled: false,
        viewport: { height: 844, width: 390 },
      });
      await page.setContent(await render(GRAPH, { hydrate: false }));
      const image = page.locator(".mdxr-graph-image");
      const intrinsic = Number(await image.getAttribute("width"));
      const mobile = await image.boundingBox();
      expect(mobile?.width).toBeGreaterThanOrEqual(intrinsic * 0.5);
      await expect(
        page.evaluate(() => document.documentElement.scrollWidth)
      ).resolves.toBe(390);
      const control = page.getByRole("checkbox", { name: "Actual size" });
      await control.check();
      await page.emulateMedia({ media: "print" });
      await expect(control.isVisible()).resolves.toBeFalsy();
      const printed = await image.boundingBox();
      expect(printed?.width).toBeLessThan(390);
      const bounds = await page
        .locator(".mdxr-graph-scroll")
        .evaluate((el) => ({
          content: el.scrollWidth,
          viewport: el.clientWidth,
        }));
      expect(bounds.content).toBeLessThanOrEqual(bounds.viewport + 1);
    } finally {
      await browser.close();
    }
  });

  it("retains an explicit original-size mode", async () => {
    const { body } = await renderDoc(
      GRAPH.replace('minScale="0.5"', 'fit="scroll"')
    );
    expect(body).not.toContain("Actual size");
    expect(body).toContain('data-fit="scroll"');
  });

  it.each(["0", "1.1", "Infinity", "0.8px"])(
    "validates scale limits: %s",
    async (scale) => {
      await expect(
        renderDoc(GRAPH.replace('minScale="0.5"', `minScale="${scale}"`))
      ).rejects.toThrow("Invalid props");
    }
  );
});

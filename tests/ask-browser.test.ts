import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { chromium } from "playwright";
import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { render } from "../src/render.js";

describe("Ask select defaults in a browser", () => {
  let browser: Browser;
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-ask-"));
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
    if (dir !== undefined) {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it.each([false, true])(
    "preserves unanswered placeholders and explicit empty values (hydrate: %s)",
    async (hydrate) => {
      const html = await render(
        `<Ask title="Defaults">
  <Question name="placeholder" type="select" placeholder="Choose one">
    <Choice value="first">First</Choice>
    <Choice value="second">Second</Choice>
  </Question>
  <Question name="empty" type="select">
    <Choice value="first">First</Choice>
    <Choice value="" checked>None</Choice>
  </Question>
  <Question name="checked" type="select" placeholder="Choose one">
    <Choice value="first">First</Choice>
    <Choice value="second" checked>Second</Choice>
  </Question>
  <Question name="first" type="select">
    <Choice value="first">First</Choice>
    <Choice value="second">Second</Choice>
  </Question>
</Ask>`,
        { dir, hydrate }
      );
      expect(html.includes("hydrateRoot")).toBe(hydrate);
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => {
        errors.push(error.message);
      });
      try {
        await page.setContent(html);
        const values = await Promise.all(
          ["placeholder", "empty", "checked", "first"].map(
            async (label) => await page.getByLabel(label).inputValue()
          )
        );
        expect(values).toStrictEqual(["", "", "second", "first"]);
        await expect(
          page.locator("[data-ask-output]").textContent()
        ).resolves.toBe(
          "# Defaults\n\n- **placeholder**:\n- **empty**:\n- **checked**: Second\n- **first**: First"
        );
        await page.getByLabel("placeholder").selectOption("second");
        await expect(
          page.locator("[data-ask-output]").textContent()
        ).resolves.toContain("- **placeholder**: Second");
        expect(errors).toStrictEqual([]);
      } finally {
        await page.close();
      }
    }
  );
});

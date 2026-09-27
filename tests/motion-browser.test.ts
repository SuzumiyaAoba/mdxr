import { chromium } from "playwright";
import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { render } from "../src/render.js";

describe("document motion preferences", () => {
  let browser: Browser;
  let html: string;

  beforeAll(async () => {
    browser = await chromium.launch();
    html = await render(
      `<SyncedTabs>
<TabItem label="First">First panel</TabItem>
<TabItem label="Second">Second panel</TabItem>
</SyncedTabs>
<Popover><PopoverTrigger>Open popup</PopoverTrigger><PopoverContent><PopoverTitle>Popup title</PopoverTitle>Popup body</PopoverContent></Popover>
<PackageInstall packages="react" />`,
      { hydrate: true }
    );
  }, 30_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.each(["no-preference", "reduce"] as const)(
    "keeps tabs and popup dismissal usable with %s motion",
    async (reducedMotion) => {
      const page = await browser.newPage({ reducedMotion });
      try {
        await page.setContent(html);
        await page.getByRole("tab", { exact: true, name: "First" }).focus();
        await page.keyboard.press("ArrowRight");
        const panel = page.getByRole("tabpanel", {
          exact: true,
          name: "Second",
        });
        await panel.waitFor({ state: "visible" });
        const panelAnimation = await panel.evaluate(
          (element) => getComputedStyle(element).animationName
        );
        expect(panelAnimation === "none").toBe(reducedMotion === "reduce");

        const trigger = page.getByRole("button", { name: "Open popup" });
        await trigger.click();
        const popup = page.locator('[data-slot="popover-content"]');
        await popup.waitFor({ state: "visible" });
        const popupAnimation = await popup.evaluate(
          (element) => getComputedStyle(element).animationName
        );
        expect(popupAnimation === "none").toBe(reducedMotion === "reduce");
        await page.keyboard.press("Escape");
        await popup.waitFor({ state: "hidden" });
        await expect(
          trigger.evaluate((element) => document.activeElement === element)
        ).resolves.toBeTruthy();

        await page.emulateMedia({ media: "print" });
        await expect(
          page.getByRole("tabpanel", { exact: true, name: "First" }).isVisible()
        ).resolves.toBeTruthy();
        await expect(
          panel.evaluate((element) => getComputedStyle(element).animationName)
        ).resolves.toBe("none");
      } finally {
        await page.close();
      }
    }
  );

  it.each([true, false] as const)(
    "crossfades copy icons to copied=%s without changing button size",
    async (copied) => {
      const page = await browser.newPage();
      try {
        await page.setContent(html);
        const copy = page
          .getByRole("button", { name: "Copy install command" })
          .first();
        const previous = copied ? ".mdxr-copy-idle" : ".mdxr-copy-done";
        const showing = copied ? ".mdxr-copy-done" : ".mdxr-copy-idle";
        const hidden = previous;
        if (!copied) {
          await copy.evaluate((element) => {
            element.classList.add("copied");
          });
        }
        await expect
          .poll(
            async () =>
              await copy
                .locator(previous)
                .evaluate((element) => getComputedStyle(element).opacity)
          )
          .toBe("1");
        const original = await copy.boundingBox();
        await copy.evaluate(
          (element, active) => element.classList.toggle("copied", active),
          copied
        );
        await expect
          .poll(
            async () =>
              await copy
                .locator(showing)
                .evaluate((element) => getComputedStyle(element).opacity)
          )
          .toBe("1");
        await expect(
          copy
            .locator(hidden)
            .evaluate((element) => getComputedStyle(element).opacity)
        ).resolves.toBe("0");
        const updated = await copy.boundingBox();
        expect({
          height: updated?.height,
          width: updated?.width,
        }).toStrictEqual({
          height: original?.height,
          width: original?.width,
        });
      } finally {
        await page.close();
      }
    }
  );
});

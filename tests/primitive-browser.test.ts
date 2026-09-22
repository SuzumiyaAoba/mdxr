import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { render } from "../src/render.js";

describe("primitive keyboard interactions", () => {
  let browser: Browser;
  let html: string;
  beforeAll(async () => {
    browser = await chromium.launch();
    html = await render(`<Tabs orientation="vertical" defaultValue="a">
<TabsList><TabsTrigger value="a">Tab A</TabsTrigger><TabsTrigger value="b">Tab B</TabsTrigger></TabsList>
<TabsContent value="a">Panel A</TabsContent><TabsContent value="b">Panel B</TabsContent>
</Tabs>
<ToggleGroup orientation="vertical"><ToggleGroupItem value="a">Toggle A</ToggleGroupItem><ToggleGroupItem value="b">Toggle B</ToggleGroupItem></ToggleGroup>
<Carousel orientation="vertical" className="mx-16 my-20" tabIndex="0">
<CarouselContent className="h-64"><CarouselItem><Input aria-label="Slide input" defaultValue="hello" /></CarouselItem><CarouselItem>Slide two</CarouselItem></CarouselContent>
<CarouselPrevious /><CarouselNext />
</Carousel>
<Calendar mode="single" />`);
  }, 30_000);

  afterAll(async () => {
    await browser?.close();
  });

  const openPage = async (): Promise<Page> => {
    const page = await browser.newPage();
    await page.setContent(html);
    // Embla enables Next after hydration and layout have completed.
    await page.waitForFunction(() => {
      const next = document.querySelector<HTMLButtonElement>(
        '[data-slot="carousel-next"]'
      );
      return next !== null && !next.disabled;
    });
    return page;
  };

  it("moves vertical tab and toggle focus down", async () => {
    const page = await openPage();
    try {
      await page.getByRole("tab", { name: "Tab A" }).focus();
      await page.keyboard.press("ArrowDown");
      await expect
        .poll(async () => await page.locator(":focus").textContent())
        .toBe("Tab B");
      await page.getByRole("button", { name: "Toggle A" }).focus();
      await page.keyboard.press("ArrowDown");
      await expect
        .poll(async () => await page.locator(":focus").textContent())
        .toBe("Toggle B");
    } finally {
      await page.close();
    }
  });

  it("leaves text editing keys to inputs inside a carousel", async () => {
    const page = await openPage();
    try {
      const input = page.getByRole("textbox", { name: "Slide input" });
      await input.focus();
      await input.evaluate((element: HTMLInputElement) => {
        element.setSelectionRange(2, 2);
      });
      await page.keyboard.press("ArrowLeft");
      await expect(
        input.evaluate((element: HTMLInputElement) => element.selectionStart)
      ).resolves.toBe(1);
    } finally {
      await page.close();
    }
  });

  it("moves a vertical carousel using ArrowDown", async () => {
    const page = await openPage();
    try {
      await page.locator('[data-slot="carousel"]').focus();
      await page.keyboard.press("ArrowDown");
      await expect
        .poll(
          async () =>
            await page
              .getByRole("button", { name: "Previous slide" })
              .isEnabled()
        )
        .toBe(true);
    } finally {
      await page.close();
    }
  });

  it("moves calendar focus to the next day", async () => {
    const page = await openPage();
    try {
      const days = page.locator('[data-slot="calendar"] button[data-day]');
      const current = days.nth(10);
      const nextDate = await days.nth(11).getAttribute("data-day");
      await current.focus();
      await page.keyboard.press("ArrowRight");
      await expect
        .poll(async () => await page.locator(":focus").getAttribute("data-day"))
        .toBe(nextDate);
    } finally {
      await page.close();
    }
  });
});

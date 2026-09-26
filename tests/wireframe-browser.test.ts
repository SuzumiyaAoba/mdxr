import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { render } from "../src/render.js";

describe("wireframe documents in the browser", () => {
  let browser: Browser;
  let page: Page;
  let errors: string[];

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  beforeEach(async () => {
    page = await browser.newPage({ viewport: { height: 900, width: 1000 } });
    page.setDefaultTimeout(5000);
    errors = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    page.on("console", (message) => {
      if (/hydration|hydrating|Minified React error/iu.test(message.text())) {
        errors.push(message.text());
      }
    });
  });
  afterEach(async () => {
    await page?.close();
  });

  afterAll(async () => {
    await browser?.close();
  });

  it.each([true, false])(
    "allows labeled input with hydration=%s and hides only empty-state placeholders",
    async (hydrate) => {
      await page.setContent(
        await render(
          `<Wireframe title="Contact" device="mobile"><WireframeStack><WireframeInput label="Email" type="email" disabled="false" /><WireframeTextarea label="Message" rows="3" /><WireframeInput label="Existing value" defaultValue="Already entered" /><WireframeButton disabled="true">Send</WireframeButton></WireframeStack></Wireframe>`,
          { hydrate }
        )
      );
      const input = page.getByLabel("Email", { exact: true });
      const overlay = page
        .locator('[data-slot="wireframe-input"]')
        .filter({ has: input })
        .locator('[aria-hidden="true"]')
        .first();
      await expect(overlay.isVisible()).resolves.toBeTruthy();
      await input.focus();
      await expect(overlay.isVisible()).resolves.toBeFalsy();
      await input.fill("test@example.com");
      await page
        .getByLabel("Message", { exact: true })
        .fill("Ready for review");
      expect({
        disabled: await page.getByRole("button", { name: "Send" }).isDisabled(),
        existing: await page.getByLabel("Existing value").inputValue(),
        overlay: await overlay.isVisible(),
        value: await input.inputValue(),
      }).toStrictEqual({
        disabled: true,
        existing: "Already entered",
        overlay: false,
        value: "test@example.com",
      });
      await input.fill("");
      await page.getByLabel("Message", { exact: true }).focus();
      await expect(overlay.isVisible()).resolves.toBeTruthy();
      expect(errors).toStrictEqual([]);
    }
  );

  it("hydrates alongside existing interactive components without resetting wireframe fields", async () => {
    await page.setContent(
      await render(
        '<Wireframe><WireframeInput label="Draft name" defaultValue="First draft" /><Tabs defaultValue="preview"><TabsList><TabsTrigger value="preview">Preview</TabsTrigger><TabsTrigger value="notes">Notes</TabsTrigger></TabsList><TabsContent value="preview"><WireframeSection variant="hero" /></TabsContent><TabsContent value="notes">Review notes</TabsContent></Tabs></Wireframe>'
      )
    );
    await page.getByRole("tab", { exact: true, name: "Notes" }).click();
    await expect
      .poll(
        async () =>
          await page.getByText("Review notes", { exact: true }).isVisible()
      )
      .toBe(true);
    await expect(page.getByLabel("Draft name").inputValue()).resolves.toBe(
      "First draft"
    );
    expect(errors).toStrictEqual([]);
  });

  it("sizes columns to the frame, fits mobile viewports, and respects dark mode and reduced motion", async () => {
    await page.setContent(
      await render(
        '<Wireframe title="Desktop" id="desktop"><WireframeSection variant="feature-grid" /></Wireframe><Wireframe title="Phone" device="mobile" id="mobile"><WireframeSection variant="content-two-column" /><WireframeText animate="shimmer" id="shimmer" /><WireframeText animate="typing" id="typing" /><WireframeText animate="pulse" id="pulse" /></Wireframe>',
        { hydrate: false }
      )
    );
    const columns = async (selector: string) =>
      await page
        .locator(selector)
        .evaluate(
          (element) =>
            getComputedStyle(element).gridTemplateColumns.split(" ").length
        );
    expect({
      desktop: await columns('#desktop [data-slot="wireframe-section"]'),
      mobile: await columns('#mobile [data-slot="wireframe-section"]'),
    }).toStrictEqual({ desktop: 3, mobile: 1 });
    const light = await page
      .locator("#mobile")
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
    });
    await expect(
      page
        .locator("#mobile")
        .evaluate((element) => getComputedStyle(element).backgroundColor)
    ).resolves.not.toBe(light);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const animations = await Promise.all(
      ["shimmer", "typing", "pulse"].map(
        async (id) =>
          await page
            .locator(`#${id}`)
            .evaluate((element) => getComputedStyle(element).animationName)
      )
    );
    expect(animations).toStrictEqual(["none", "none", "none"]);
    await page.setViewportSize({ height: 844, width: 390 });
    expect({
      columns: await columns('#desktop [data-slot="wireframe-section"]'),
      fits: await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      ),
    }).toStrictEqual({ columns: 1, fits: true });
    expect(errors).toStrictEqual([]);
  });
});

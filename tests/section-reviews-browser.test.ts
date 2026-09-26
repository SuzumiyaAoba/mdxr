import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { render } from "../src/render.js";

const SOURCE = `# Review document

Introduction.

## Design **details**

First section content.

<Input aria-label="Draft" defaultValue="Initial" />

<Tabs defaultValue="one">
<TabsList><TabsTrigger value="one">One</TabsTrigger><TabsTrigger value="two">Two</TabsTrigger></TabsList>
<TabsContent value="one">First panel</TabsContent><TabsContent value="two">Second panel</TabsContent>
</Tabs>

### Detail

Nested detail.

> ## Quoted heading

## 日本語 & \`code\`

Second section content.

## Design **details**

Duplicate heading, different content.
`;

const STORAGE_KEY = "mdxr:section-reviews:v1:/project/review.mdx";
const review = (page: Page, id: string) =>
  page
    .locator(`mdxr-section-review[data-section-id="${id}"]`)
    .getByRole("button");
const mode = (page: Page, name: string) =>
  page
    .getByRole("group", { name: "Document view" })
    .getByRole("button", { exact: true, name });
const sections = (page: Page) =>
  page.getByRole("tablist", { exact: true, name: "Sections" });

describe("section review interactions", () => {
  let browser: Browser;
  let html: string;
  let changed: string;
  let other: string;
  let plain: string;
  let noHeadings: string;

  beforeAll(async () => {
    browser = await chromium.launch();
    [html, changed, other, plain, noHeadings] = await Promise.all([
      render(SOURCE, { filePath: "/project/review.mdx" }),
      render(
        SOURCE.replace(
          "Introduction.",
          "Longer introduction.\n\nAnother paragraph."
        ).replace("Nested detail.", "Updated nested detail."),
        { filePath: "/project/review.mdx" }
      ),
      render(SOURCE, { filePath: "/project/other.mdx" }),
      render(
        '<Plan title="Plain">\n\n## Alpha\n\nAlpha text.\n\n## Beta\n\nBeta text.\n\n</Plan>',
        { filePath: "/project/plain.mdx", hydrate: false }
      ),
      render("# No sections\n\n> ## Nested only", { hydrate: false }),
    ]);
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  const open = async (content = html) => {
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const response = { html: content };
    await page.route("http://mdxr.test/**", async (route) => {
      await route.fulfill({ body: response.html, contentType: "text/html" });
    });
    await page.goto("http://mdxr.test/review");
    return { page, response };
  };

  it("toggles each h2 independently with mouse and keyboard, and restores changes after reload", async () => {
    const { page } = await open();
    try {
      expect({
        controls: await page.locator("mdxr-section-review").count(),
        first: await review(page, "design-details").getAttribute(
          "aria-pressed"
        ),
      }).toStrictEqual({ controls: 3, first: "false" });
      await review(page, "design-details").click();
      expect({
        duplicate: await review(page, "design-details-1").getAttribute(
          "aria-pressed"
        ),
        first: await review(page, "design-details").textContent(),
      }).toStrictEqual({ duplicate: "false", first: "Reviewed" });
      await review(page, "日本語-code").press("Space");
      await page.reload();
      expect({
        first: await review(page, "design-details").getAttribute(
          "aria-pressed"
        ),
        second: await review(page, "日本語-code").getAttribute("aria-pressed"),
      }).toStrictEqual({ first: "true", second: "true" });
      await review(page, "design-details").press("Enter");
      await page.reload();
      expect({
        first: await review(page, "design-details").textContent(),
        headings: await page
          .getByRole("heading", { exact: true, name: "Design details" })
          .count(),
        second: await review(page, "日本語-code").getAttribute("aria-pressed"),
      }).toStrictEqual({ first: "Not reviewed", headings: 2, second: "true" });
    } finally {
      await page.close();
    }
  });

  it("keeps hydrated controls working and shows section progress in Pages view", async () => {
    const { page } = await open();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    try {
      await review(page, "design-details").click();
      await page.reload();
      await page.getByRole("textbox", { name: "Draft" }).fill("Kept draft");
      await page.getByRole("tab", { exact: true, name: "Two" }).click();
      await expect
        .poll(async () => await page.getByText("Second panel").isVisible())
        .toBe(true);
      await mode(page, "Pages").click();
      const first = sections(page)
        .getByRole("tab", { exact: true, name: "Design details" })
        .first();
      await first.click();
      expect({
        first: await first.getAttribute("aria-description"),
        summary: await page
          .locator("[data-section-review-summary]")
          .textContent(),
      }).toStrictEqual({
        first: "Reviewed",
        summary: "1 / 3 sections reviewed",
      });
      await sections(page).getByRole("tab", { name: "日本語 & code" }).click();
      await review(page, "日本語-code").click();
      await expect(
        page.locator("[data-section-review-summary]").textContent()
      ).resolves.toBe("2 / 3 sections reviewed");
      await first.click();
      expect({
        draft: await page.getByRole("textbox", { name: "Draft" }).inputValue(),
        panel: await page.getByText("Second panel").isVisible(),
      }).toStrictEqual({ draft: "Kept draft", panel: true });
      await mode(page, "Document").click();
      expect({
        errors,
        reviewed: await review(page, "日本語-code").getAttribute(
          "aria-pressed"
        ),
      }).toStrictEqual({ errors: [], reviewed: "true" });
    } finally {
      await page.close();
    }
  });

  it("requires re-review only for changed sections and separates document paths", async () => {
    const { page, response } = await open();
    try {
      await review(page, "design-details").click();
      await review(page, "日本語-code").click();
      await review(page, "design-details-1").click();
      response.html = changed;
      await page.reload();
      await expect(
        review(page, "design-details").getAttribute("aria-pressed")
      ).resolves.toBe("false");
      await expect(
        review(page, "日本語-code").getAttribute("aria-pressed")
      ).resolves.toBe("true");
      await expect(
        review(page, "design-details-1").getAttribute("aria-pressed")
      ).resolves.toBe("true");
      response.html = other;
      await page.reload();
      await expect(
        review(page, "日本語-code").getAttribute("aria-pressed")
      ).resolves.toBe("false");
      response.html = changed;
      await page.reload();
      await expect(
        review(page, "日本語-code").getAttribute("aria-pressed")
      ).resolves.toBe("true");
    } finally {
      await page.close();
    }
  });

  it("synchronizes reviews between tabs without discarding other section statuses", async () => {
    const context = await browser.newContext();
    try {
      await context.route("http://mdxr.test/**", async (route) => {
        await route.fulfill({ body: html, contentType: "text/html" });
      });
      const first = await context.newPage();
      const second = await context.newPage();
      await first.goto("http://mdxr.test/review");
      await second.goto("http://mdxr.test/review");
      await review(first, "design-details").click();
      await expect
        .poll(
          async () =>
            await review(second, "design-details").getAttribute("aria-pressed")
        )
        .toBe("true");
      await review(second, "日本語-code").click();
      await expect
        .poll(
          async () =>
            await review(first, "日本語-code").getAttribute("aria-pressed")
        )
        .toBe("true");
      await first.reload();
      await expect(
        review(first, "design-details").getAttribute("aria-pressed")
      ).resolves.toBe("true");
      await expect(
        review(first, "日本語-code").getAttribute("aria-pressed")
      ).resolves.toBe("true");
    } finally {
      await context.close();
    }
  });

  it.each([true, false])(
    "keeps reviews usable when storage is blocked: %s",
    async (unavailable) => {
      const { page } = await open();
      try {
        await page.addInitScript((blocked) => {
          if (blocked) {
            Object.defineProperty(window, "localStorage", {
              get() {
                throw new Error("Storage unavailable");
              },
            });
          } else {
            Storage.prototype.setItem = () => {
              throw new Error("Storage full");
            };
          }
        }, unavailable);
        await page.reload();
        await expect(
          page.locator("mdxr-section-review").getByRole("status").count()
        ).resolves.toBe(0);
        await review(page, "design-details").click();
        await expect(
          review(page, "design-details").getAttribute("aria-pressed")
        ).resolves.toBe("true");
        await expect(
          page
            .locator('mdxr-section-review[data-section-id="design-details"]')
            .getByRole("status")
            .textContent()
        ).resolves.toBe("Not saved");
        await expect(
          page.locator("mdxr-section-review").getByRole("status").count()
        ).resolves.toBe(1);
        await review(page, "日本語-code").click();
        await expect(
          review(page, "design-details").getAttribute("aria-pressed")
        ).resolves.toBe("true");
      } finally {
        await page.close();
      }
    }
  );

  it("preserves corrupt saved data while allowing temporary review status", async () => {
    const { page } = await open();
    try {
      await page.evaluate((key) => {
        localStorage.setItem(key, "broken saved state");
      }, STORAGE_KEY);
      await page.reload();
      await review(page, "design-details").click();
      await expect(
        review(page, "design-details").getAttribute("aria-pressed")
      ).resolves.toBe("true");
      await expect(
        page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
      ).resolves.toBe("broken saved state");
    } finally {
      await page.close();
    }
  });

  it("supports no-hydrate Plan documents on mobile and hides controls when printing", async () => {
    const { page } = await open(plain);
    try {
      await page.setViewportSize({ height: 844, width: 390 });
      await review(page, "alpha").click();
      await mode(page, "Pages").click();
      await sections(page)
        .getByRole("tab", { exact: true, name: "Beta" })
        .click();
      await review(page, "beta").click();
      await expect(
        page.locator("[data-section-review-summary]").textContent()
      ).resolves.toBe("2 / 2 sections reviewed");
      await expect(
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
      ).resolves.toBeTruthy();
      await page.emulateMedia({ media: "print" });
      await expect(review(page, "beta").isVisible()).resolves.toBeFalsy();
      await expect(
        page.getByText("Alpha text.").isVisible()
      ).resolves.toBeTruthy();
      await expect(
        page.getByText("Beta text.").isVisible()
      ).resolves.toBeTruthy();
    } finally {
      await page.close();
    }
  });

  it("keeps documents readable without JavaScript or reviewable headings", async () => {
    const page = await browser.newPage({ javaScriptEnabled: false });
    const headingless = await open(noHeadings);
    try {
      await page.setContent(plain);
      await expect(
        page.locator("mdxr-section-review").getByRole("button").count()
      ).resolves.toBe(0);
      await expect(
        page.getByText("Alpha text.").isVisible()
      ).resolves.toBeTruthy();
      await expect(
        headingless.page.locator("mdxr-section-review").count()
      ).resolves.toBe(0);
    } finally {
      await page.close();
      await headingless.page.close();
    }
  });
});

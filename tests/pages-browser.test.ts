import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { render } from "../src/render.js";

const source = `# Reading modes

Introduction before any section.

## First **section**

First page content.

<Input aria-label="Draft" defaultValue="initial" />

<Tabs defaultValue="one">
<TabsList><TabsTrigger value="one">One</TabsTrigger><TabsTrigger value="two">Two</TabsTrigger></TabsList>
<TabsContent value="one">First inner panel</TabsContent><TabsContent value="two">Second inner panel</TabsContent>
</Tabs>

> ## Quoted heading
>
> This stays inside the first page.

[Go to detail](#detail)

## 日本語 & \`code\`

Second page content.

### Detail

Deep link destination.

## First **section**

Duplicate heading content.
`;

const mode = (page: Page, name: string) =>
  page
    .getByRole("group", { name: "Document view" })
    .getByRole("button", { exact: true, name });
const sections = (page: Page) =>
  page.getByRole("tablist", { exact: true, name: "Sections" });

describe("document page navigation", () => {
  let browser: Browser;
  let html: string;
  let plain: string;
  let plan: string;
  let noHeadings: string;

  beforeAll(async () => {
    browser = await chromium.launch();
    [html, plain, plan, noHeadings] = await Promise.all([
      render(source),
      render(
        "---\ntitle: Plain\n---\n\n## Alpha\n\nAlpha text.\n\n## Beta\n\nBeta text.",
        { hydrate: false }
      ),
      render(
        '<Plan title="Wrapped plan">\n\nIntroduction.\n\n## Alpha\n\nAlpha text.\n\n## Beta\n\nBeta text.\n\n</Plan>'
      ),
      render("# No pages\n\n> ## Nested only\n\n```md\n## Not a heading\n```", {
        hydrate: false,
      }),
    ]);
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  const openPage = async (content = html, hash = ""): Promise<Page> => {
    const page = await browser.newPage();
    await page.route("http://mdxr.test/**", async (route) => {
      await route.fulfill({ body: content, contentType: "text/html" });
    });
    await page.goto(`http://mdxr.test/${hash}`);
    return page;
  };

  it("switches between a continuous document and h2 pages without losing content", async () => {
    const page = await openPage();
    try {
      expect({
        document: await mode(page, "Document").getAttribute("aria-pressed"),
        second: await page.getByText("Second page content.").isVisible(),
        tabs: await sections(page).isVisible(),
      }).toStrictEqual({ document: "true", second: true, tabs: false });
      await mode(page, "Pages").click();
      await expect(
        sections(page).getByRole("tab").allTextContents()
      ).resolves.toStrictEqual([
        "Overview",
        "First section",
        "日本語 & code",
        "First section",
      ]);
      expect({
        first: await page.getByText("First page content.").isVisible(),
        overview: await page
          .getByText("Introduction before any section.")
          .isVisible(),
      }).toStrictEqual({ first: false, overview: true });
      await sections(page)
        .getByRole("tab", { exact: true, name: "First section" })
        .first()
        .click();
      expect({
        first: await page.getByText("First page content.").isVisible(),
        nested: await page
          .getByRole("heading", { name: "Quoted heading" })
          .isVisible(),
        overview: await page
          .getByText("Introduction before any section.")
          .isVisible(),
        second: await page.getByText("Second page content.").isVisible(),
      }).toStrictEqual({
        first: true,
        nested: true,
        overview: false,
        second: false,
      });
      await mode(page, "Document").click();
      expect({
        content: await Promise.all(
          [
            "First page content.",
            "Second page content.",
            "Introduction before any section.",
            "Duplicate heading content.",
          ].map(async (text) => await page.getByText(text).isVisible())
        ),
        // Only the authored Tabs remains.
        panels: await page.getByRole("tabpanel").count(),
      }).toStrictEqual({ content: [true, true, true, true], panels: 1 });
    } finally {
      await page.close();
    }
  });

  it("preserves hydrated controls and form state across pages and modes", async () => {
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });
    try {
      await page.route("http://mdxr.test/**", async (route) => {
        await route.fulfill({ body: html, contentType: "text/html" });
      });
      await page.addInitScript(() => {
        localStorage.setItem("mdxr-view", "pages");
      });
      await page.goto("http://mdxr.test/#first-section");
      await page.getByRole("textbox", { name: "Draft" }).fill("Kept draft");
      await page.getByRole("tab", { exact: true, name: "Two" }).click();
      await expect
        .poll(
          async () => await page.getByText("Second inner panel").isVisible()
        )
        .toBe(true);
      await sections(page).getByRole("tab", { name: "日本語 & code" }).click();
      await sections(page)
        .getByRole("tab", { exact: true, name: "First section" })
        .first()
        .click();
      await expect(
        page.getByRole("textbox", { name: "Draft" }).inputValue()
      ).resolves.toBe("Kept draft");
      await expect(
        page.getByText("Second inner panel").isVisible()
      ).resolves.toBeTruthy();
      await mode(page, "Document").click();
      await mode(page, "Pages").click();
      expect({
        draft: await page
          .getByRole("textbox", { includeHidden: true, name: "Draft" })
          .inputValue(),
        selected: await sections(page)
          .getByRole("tab", { selected: true })
          .textContent(),
      }).toStrictEqual({ draft: "Kept draft", selected: "First section" });
      expect(errors).toStrictEqual([]);
    } finally {
      await page.close();
    }
  });

  it("supports vertical tab keys and keeps the selected panel labelled", async () => {
    const page = await openPage();
    try {
      await mode(page, "Pages").click();
      const overview = sections(page).getByRole("tab", { name: "Overview" });
      await overview.focus();
      await page.keyboard.press("ArrowDown");
      expect({
        focus: await page.locator(":focus").textContent(),
        label: await page
          .locator("#mdxr-content")
          .getAttribute("aria-labelledby"),
        selected: await page.locator(":focus").getAttribute("aria-selected"),
      }).toStrictEqual({
        focus: "First section",
        label: await page.locator(":focus").getAttribute("id"),
        selected: "true",
      });
      await page.keyboard.press("End");
      expect({
        hash: new URL(page.url()).hash,
        visible: await page.getByText("Duplicate heading content.").isVisible(),
      }).toStrictEqual({ hash: "#first-section-1", visible: true });
      await page.keyboard.press("ArrowDown");
      await expect(page.locator(":focus").textContent()).resolves.toBe(
        "Overview"
      );
      await page.keyboard.press("ArrowUp");
      await expect(
        page.getByText("Duplicate heading content.").isVisible()
      ).resolves.toBeTruthy();
      await page.keyboard.press("Home");
      await expect(page.locator(":focus").textContent()).resolves.toBe(
        "Overview"
      );
    } finally {
      await page.close();
    }
  });

  it("reveals linked subheadings and follows history, reloads, and encoded hashes", async () => {
    const page = await openPage();
    try {
      await mode(page, "Pages").click();
      await sections(page)
        .getByRole("tab", { exact: true, name: "First section" })
        .first()
        .click();
      await page.getByRole("link", { name: "Go to detail" }).click();
      expect({
        selected: await sections(page)
          .getByRole("tab", { name: "日本語 & code" })
          .getAttribute("aria-selected"),
        visible: await page.getByText("Deep link destination.").isVisible(),
      }).toStrictEqual({ selected: "true", visible: true });
      await page.goBack();
      await expect
        .poll(
          async () => await page.getByText("First page content.").isVisible()
        )
        .toBe(true);
      await page.goForward();
      await expect
        .poll(
          async () => await page.getByText("Deep link destination.").isVisible()
        )
        .toBe(true);
      await page.reload();
      expect({
        pages: await mode(page, "Pages").getAttribute("aria-pressed"),
        visible: await page.getByText("Deep link destination.").isVisible(),
      }).toStrictEqual({ pages: "true", visible: true });
      await sections(page).getByRole("tab", { name: "日本語 & code" }).click();
      await page.reload();
      expect({
        hash: new URL(page.url()).hash,
        visible: await page.getByText("Second page content.").isVisible(),
      }).toStrictEqual({
        hash: `#${encodeURIComponent("日本語-code")}`,
        visible: true,
      });
    } finally {
      await page.close();
    }
  });

  it("supports plain Markdown without hydration and avoids an empty frontmatter page", async () => {
    const page = await openPage(plain);
    try {
      await mode(page, "Pages").click();
      await expect(
        sections(page).getByRole("tab").allTextContents()
      ).resolves.toStrictEqual(["Alpha", "Beta"]);
      await sections(page).getByRole("tab", { name: "Beta" }).click();
      await expect(
        page.getByText("Beta text.").isVisible()
      ).resolves.toBeTruthy();
      await expect(
        page.getByText("Alpha text.").isVisible()
      ).resolves.toBeFalsy();
      await expect(
        page.getByRole("heading", { exact: true, name: "Plain" }).isVisible()
      ).resolves.toBeTruthy();
    } finally {
      await page.close();
    }
  });

  it("splits headings inside the Plan document root", async () => {
    const page = await openPage(plan);
    try {
      await mode(page, "Pages").click();
      await expect(
        sections(page).getByRole("tab").allTextContents()
      ).resolves.toStrictEqual(["Overview", "Alpha", "Beta"]);
      await sections(page).getByRole("tab", { name: "Beta" }).click();
      await expect(
        page.getByText("Alpha text.").isVisible()
      ).resolves.toBeFalsy();
      await expect(
        page.getByText("Beta text.").isVisible()
      ).resolves.toBeTruthy();
      await expect(
        page.getByRole("heading", { name: "Wrapped plan" }).count()
      ).resolves.toBe(1);
    } finally {
      await page.close();
    }
  });

  it("prints every page and restores the on-screen selection", async () => {
    const page = await openPage(plain);
    try {
      await mode(page, "Pages").click();
      await expect(
        page.getByText("Beta text.").isVisible()
      ).resolves.toBeFalsy();
      await page.emulateMedia({ media: "print" });
      expect({
        alpha: await page.getByText("Alpha text.").isVisible(),
        beta: await page.getByText("Beta text.").isVisible(),
        controls: await mode(page, "Pages").isVisible(),
        tabs: await sections(page).isVisible(),
      }).toStrictEqual({
        alpha: true,
        beta: true,
        controls: false,
        tabs: false,
      });
      await page.emulateMedia({ media: "screen" });
      await expect(
        page.getByText("Beta text.").isVisible()
      ).resolves.toBeFalsy();
    } finally {
      await page.close();
    }
  });

  it("keeps vertical navigation and content reachable on a narrow screen", async () => {
    const page = await openPage(plain);
    try {
      await page.setViewportSize({ height: 844, width: 390 });
      await mode(page, "Pages").click();
      await sections(page).getByRole("tab", { name: "Beta" }).click();
      await expect(
        page.getByText("Beta text.").isVisible()
      ).resolves.toBeTruthy();
      const layout = await page.evaluate(() => {
        const tabs = document
          .querySelector("[data-mdxr-page-tabs]")
          ?.getBoundingClientRect();
        const content = document
          .querySelector("#mdxr-content")
          ?.getBoundingClientRect();
        return {
          contained: document.documentElement.scrollWidth <= innerWidth,
          stacked:
            tabs !== undefined &&
            content !== undefined &&
            tabs.bottom <= content.top,
        };
      });
      expect(layout).toStrictEqual({ contained: true, stacked: true });
    } finally {
      await page.close();
    }
  });

  it("keeps the continuous fallback without JavaScript or document h2 headings", async () => {
    const page = await browser.newPage({ javaScriptEnabled: false });
    const headingless = await openPage(noHeadings);
    try {
      await page.setContent(plain);
      await expect(
        page.getByText("Alpha text.").isVisible()
      ).resolves.toBeTruthy();
      await expect(
        page.getByText("Beta text.").isVisible()
      ).resolves.toBeTruthy();
      await expect(mode(page, "Pages").isVisible()).resolves.toBeFalsy();
      await expect(mode(headingless, "Pages").isVisible()).resolves.toBeFalsy();
    } finally {
      await page.close();
      await headingless.close();
    }
  });

  it("reveals an annotation target on a hidden page", async () => {
    const page = await openPage(plain);
    try {
      await mode(page, "Pages").click();
      await page
        .getByText("Beta text.")
        .dispatchEvent("mdxr:reveal", { bubbles: true });
      await expect(
        page.getByText("Beta text.").isVisible()
      ).resolves.toBeTruthy();
      await expect(
        sections(page)
          .getByRole("tab", { name: "Beta" })
          .getAttribute("aria-selected")
      ).resolves.toBe("true");
    } finally {
      await page.close();
    }
  });

  it("returns to the first page when history restores a URL without a hash", async () => {
    const page = await openPage(plain);
    try {
      await mode(page, "Pages").click();
      await sections(page).getByRole("tab", { name: "Beta" }).click();
      await page.goBack();
      await expect
        .poll(async () => await page.getByText("Alpha text.").isVisible())
        .toBe(true);
      expect(new URL(page.url()).hash).toBe("");
    } finally {
      await page.close();
    }
  });

  it("allows switching with blocked storage and a malformed hash", async () => {
    const page = await browser.newPage();
    try {
      await page.addInitScript(() => {
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new Error("Storage is unavailable");
          },
        });
      });
      await page.route("http://mdxr.test/**", async (route) => {
        await route.fulfill({ body: plain, contentType: "text/html" });
      });
      await page.goto("http://mdxr.test/#%E0%A4%A");
      await mode(page, "Pages").click();
      await sections(page).getByRole("tab", { name: "Beta" }).click();
      await expect(
        page.getByText("Beta text.").isVisible()
      ).resolves.toBeTruthy();
      await mode(page, "Document").click();
      await expect(
        page.getByText("Alpha text.").isVisible()
      ).resolves.toBeTruthy();
    } finally {
      await page.close();
    }
  });
});

import { chromium } from "playwright";
import type { Browser, Frame, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { render } from "../src/render.js";

const IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='160'%3E%3Crect width='640' height='160' fill='%23e0f2fe'/%3E%3Ctext x='40' y='85' font-size='24'%3EArchitecture%3C/text%3E%3C/svg%3E";
const SOURCE = `# Review plan

## Design

Render **rich text** and diagrams. 日本語の注釈も使えます。

<Figure src="${IMAGE}" alt="System architecture" caption="Architecture" />

<details><summary>More details</summary>Keep this interactive.</details>
`;

const selectText = async (
  page: Frame | Page,
  quote = "rich text"
): Promise<void> => {
  await page.evaluate((text) => {
    const root = document.querySelector("#mdxr-root");
    if (root === null) {
      throw new Error("Document missing");
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node !== null) {
      const start = node.textContent?.indexOf(text) ?? -1;
      if (start >= 0) {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + text.length);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
        return;
      }
      node = walker.nextNode();
    }
    throw new Error(`Text not found: ${text}`);
  }, quote);
};

const addTextComment = async (
  page: Page,
  comment = "Explain the formatting."
): Promise<void> => {
  await page.locator("#mdxr-root").click({ position: { x: 5, y: 5 } });
  await selectText(page);
  await page.getByRole("button", { exact: true, name: "Add comment" }).click();
  await page
    .getByRole("textbox", { exact: true, name: "Comment" })
    .fill(comment);
  await page.getByRole("button", { exact: true, name: "Save comment" }).click();
};

const clipboardStub = async (page: Frame | Page): Promise<void> => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          document.documentElement.dataset.feedback = text;
        },
      },
    });
  });
};

describe("document annotation interactions", () => {
  let browser: Browser;
  let html: string;
  beforeAll(async () => {
    browser = await chromium.launch();
    html = await render(SOURCE, { filePath: "/project/review.mdx" });
  });

  afterAll(async () => {
    await browser?.close();
  });

  const openPage = async (content = html): Promise<Page> => {
    const page = await browser.newPage({
      viewport: { height: 850, width: 1280 },
    });
    await page.route("http://mdxr.test/**", async (route) => {
      await route.fulfill({ body: content, contentType: "text/html" });
    });
    await page.goto("http://mdxr.test/review");
    return page;
  };

  it.each([false, true])(
    "adds, edits, restores, exports, and deletes text and figure comments (hydrate: %s)",
    async (hydrate) => {
      const page = await openPage(
        hydrate
          ? html
          : await render(SOURCE, {
              filePath: "/project/review.mdx",
              hydrate: false,
            })
      );
      const errors: string[] = [];
      page.on("pageerror", (error) => {
        errors.push(error.message);
      });
      try {
        await clipboardStub(page);
        await addTextComment(page, "書式を詳しく説明してください。");
        await page
          .getByRole("button", { exact: true, name: "Select figure" })
          .click();
        await page
          .getByRole("button", { exact: true, name: "Comment on figure" })
          .click();
        await page
          .getByRole("textbox", { exact: true, name: "Comment" })
          .fill("Label the arrows.");
        await page
          .getByRole("button", { exact: true, name: "Save comment" })
          .click();
        await page
          .getByRole("button", { exact: true, name: "Edit" })
          .first()
          .click();
        await page
          .getByRole("textbox", { exact: true, name: "Comment" })
          .fill("例を追加してください。");
        await page
          .getByRole("button", { exact: true, name: "Save changes" })
          .click();
        await page
          .getByRole("button", { exact: true, name: "Copy Markdown" })
          .click();
        const markdown = await page
          .locator("html")
          .getAttribute("data-feedback");
        for (const expected of [
          "例を追加してください。",
          "> rich text",
          "/project/review.mdx:5",
          "Section: Design",
          "Label the arrows.",
          "## 2. Figure comment",
          "/project/review.mdx:7",
        ]) {
          expect(markdown).toContain(expected);
        }
        await page.reload();
        await page.getByRole("button", { name: "Annotate" }).click();
        expect({
          attached: await page
            .getByRole("button", { name: "Show target" })
            .first()
            .isEnabled(),
          count: await page.locator(".mdxr-annotation-card").count(),
        }).toStrictEqual({ attached: true, count: 2 });
        await page
          .getByRole("button", { exact: true, name: "Delete" })
          .first()
          .click();
        await expect(
          page.locator(".mdxr-annotation-card").count()
        ).resolves.toBe(1);
        await page.getByRole("button", { name: "Close annotations" }).click();
        await page.getByText("More details", { exact: true }).click();
        await expect(
          page.locator("details").getAttribute("open")
        ).resolves.not.toBeNull();
        expect(errors).toStrictEqual([]);
      } finally {
        await page.close();
      }
    }
  );

  it("selects across inline elements with the keyboard shortcut and preserves a draft on close", async () => {
    const page = await openPage();
    try {
      await page.evaluate(() => {
        const paragraph = document.querySelector("#mdxr-root p");
        if (paragraph === null) {
          throw new Error("Paragraph missing");
        }
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        window.getSelection()?.addRange(range);
      });
      await page.keyboard.press("Control+Shift+m");
      await page
        .getByRole("textbox", { exact: true, name: "Comment" })
        .fill("Keep this draft");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Annotate" }).click();
      await expect(
        page.getByRole("textbox", { exact: true, name: "Comment" }).inputValue()
      ).resolves.toBe("Keep this draft");
      await page
        .getByRole("button", { exact: true, name: "Save comment" })
        .click();
      await expect(
        page.locator(".mdxr-annotation-card blockquote").textContent()
      ).resolves.toContain("Render rich text and diagrams. 日本語");
    } finally {
      await page.close();
    }
  });

  it.each([
    ["allow-scripts allow-same-origin", "click"],
    ["allow-scripts allow-same-origin", "Control+Enter"],
    ["allow-scripts allow-same-origin", "Meta+Enter"],
    ["allow-scripts", "click"],
    ["allow-scripts", "Control+Enter"],
    ["allow-scripts", "Meta+Enter"],
  ])(
    "saves and edits comments in a sandbox without form permissions (%s, %s)",
    async (sandbox, action) => {
      const page = await browser.newPage({
        viewport: { height: 900, width: 1400 },
      });
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
        await page.route("http://mdxr.test/**", async (route) => {
          await route.fulfill({
            body: route.request().url().endsWith("/preview")
              ? `<iframe name="preview" sandbox="${sandbox}" src="/review" width="1280" height="850"></iframe>`
              : html,
            contentType: "text/html",
          });
        });
        await page.goto("http://mdxr.test/preview");
        const frame = page.frame("preview");
        if (frame === null) {
          throw new Error("Preview frame missing");
        }
        await clipboardStub(frame);
        await frame.locator("#mdxr-root").click({ position: { x: 5, y: 5 } });
        await selectText(frame);
        await frame
          .getByRole("button", { exact: true, name: "Add comment" })
          .click();
        const input = frame.getByRole("textbox", {
          exact: true,
          name: "Comment",
        });
        const save = frame.getByRole("button", {
          exact: true,
          name: "Save comment",
        });
        await input.fill("   ");
        await save.click();
        expect({
          count: await frame.locator(".mdxr-annotation-card").count(),
          draftVisible: await input.isVisible(),
        }).toStrictEqual({ count: 0, draftVisible: true });
        await input.fill("埋め込みプレビューのコメント");
        await (action === "click" ? save.click() : input.press(action));
        expect({
          count: await frame.locator(".mdxr-annotation-card").count(),
          draftVisible: await input.isVisible(),
          status: await frame.locator("[data-annotation-status]").textContent(),
        }).toStrictEqual({
          count: 1,
          draftVisible: false,
          status: sandbox.includes("allow-same-origin")
            ? "Saved in this browser"
            : "Browser storage is unavailable. Copy Markdown before closing this page to keep your comments.",
        });
        await frame.getByRole("button", { exact: true, name: "Edit" }).click();
        await input.fill("更新したコメント");
        await (action === "click"
          ? frame
              .getByRole("button", { exact: true, name: "Save changes" })
              .click()
          : input.press(action));
        expect({
          comment: await frame
            .locator(".mdxr-annotation-comment-body")
            .textContent(),
          count: await frame.locator(".mdxr-annotation-card").count(),
        }).toStrictEqual({ comment: "更新したコメント", count: 1 });
        await frame
          .getByRole("button", { exact: true, name: "Copy Markdown" })
          .click();
        await expect(
          frame.evaluate(() => document.documentElement.dataset.feedback)
        ).resolves.toContain("更新したコメント");
        await page.reload();
        const restored = page.frameLocator('iframe[name="preview"]');
        await restored.getByRole("button", { name: "Annotate" }).click();
        expect({
          comments: await restored
            .locator(".mdxr-annotation-comment-body")
            .allTextContents(),
          errors,
        }).toStrictEqual({
          comments: sandbox.includes("allow-same-origin")
            ? ["更新したコメント"]
            : [],
          errors: [],
        });
      } finally {
        await page.close();
      }
    }
  );

  it("clicks a figure in pick mode without activating its link", async () => {
    const linked = SOURCE.replace(
      "<Figure",
      '<a href="#unexpected"><Figure'
    ).replace("/>", "/></a>");
    const page = await openPage(
      await render(linked, { filePath: "/project/review.mdx" })
    );
    try {
      await page.getByRole("button", { name: "Annotate" }).click();
      await page
        .getByRole("button", { exact: true, name: "Select figure" })
        .click();
      await page.getByRole("img", { name: "System architecture" }).click();
      await expect(
        page.locator("[data-annotation-draft-quote]").textContent()
      ).resolves.toBe("Architecture");
      await page
        .getByRole("textbox", { exact: true, name: "Comment" })
        .fill("Clarify the diagram");
      await page
        .getByRole("button", { exact: true, name: "Save comment" })
        .click();
      await expect(
        page.locator(".mdxr-annotation-outline").count()
      ).resolves.toBe(1);
      expect(page.url()).toBe("http://mdxr.test/review");
    } finally {
      await page.close();
    }
  });

  it("retains detached quotes after edits and keeps documents separate", async () => {
    const page = await openPage();
    try {
      await addTextComment(page);
      const changed = await render(SOURCE.replace("rich text", "new wording"), {
        filePath: "/project/review.mdx",
      });
      await page.route("http://mdxr.test/changed", async (route) => {
        await route.fulfill({ body: changed, contentType: "text/html" });
      });
      await page.goto("http://mdxr.test/changed");
      await page.getByRole("button", { name: "Annotate" }).click();
      await expect(
        page.locator(".mdxr-annotation-card blockquote").textContent()
      ).resolves.toBe("rich text");
      await expect(
        page.getByRole("button", { name: "Show target" }).isDisabled()
      ).resolves.toBeTruthy();
      await clipboardStub(page);
      await page
        .getByRole("button", { exact: true, name: "Copy Markdown" })
        .click();
      await expect(
        page.evaluate(() => document.documentElement.dataset.feedback)
      ).resolves.toContain("Target no longer found");
      const other = await render(SOURCE, { filePath: "/project/other.mdx" });
      await page.route("http://mdxr.test/other", async (route) => {
        await route.fulfill({ body: other, contentType: "text/html" });
      });
      await page.goto("http://mdxr.test/other");
      await expect(
        page.locator("[data-annotation-count]").textContent()
      ).resolves.toBe("0");
    } finally {
      await page.close();
    }
  });

  it("reattaches moved text, updates source lines, and refuses newly ambiguous matches", async () => {
    const page = await openPage();
    try {
      await addTextComment(page);
      const moved = await render(
        SOURCE.replace("## Design", "An inserted introduction.\n\n## Design"),
        { filePath: "/project/review.mdx" }
      );
      await page.route("http://mdxr.test/moved", async (route) => {
        await route.fulfill({ body: moved, contentType: "text/html" });
      });
      await page.goto("http://mdxr.test/moved");
      await page.getByRole("button", { name: "Annotate" }).click();
      await expect(
        page.getByRole("button", { name: "Show target" }).isEnabled()
      ).resolves.toBeTruthy();
      await expect(
        page.locator(".mdxr-annotation-location").getAttribute("title")
      ).resolves.toContain("/project/review.mdx:7");
      const duplicate = await render(
        `${SOURCE}\nRender **rich text** and diagrams. 日本語の注釈も使えます。\n`,
        { filePath: "/project/review.mdx" }
      );
      await page.route("http://mdxr.test/duplicate", async (route) => {
        await route.fulfill({ body: duplicate, contentType: "text/html" });
      });
      await page.goto("http://mdxr.test/duplicate");
      await page.getByRole("button", { name: "Annotate" }).click();
      await expect(
        page.getByRole("button", { name: "Show target" }).isDisabled()
      ).resolves.toBeTruthy();
    } finally {
      await page.close();
    }
  });

  it("preserves corrupt storage until a new comment is explicitly saved", async () => {
    const page = await openPage();
    try {
      await page.evaluate(() => {
        localStorage.setItem(
          "mdxr:annotations:v1:/project/review.mdx",
          "broken json"
        );
      });
      await page.reload();
      await page.getByRole("button", { name: "Annotate" }).click();
      await expect(
        page.locator("[data-annotation-status]").textContent()
      ).resolves.toContain("could not be loaded");
      await expect(
        page.evaluate(() =>
          localStorage.getItem("mdxr:annotations:v1:/project/review.mdx")
        )
      ).resolves.toBe("broken json");
      await addTextComment(page);
      await expect(page.locator(".mdxr-annotation-card").count()).resolves.toBe(
        1
      );
    } finally {
      await page.close();
    }
  });

  it("offers manual Markdown when clipboard and storage are blocked, and treats comments as text", async () => {
    const page = await openPage();
    try {
      await page.evaluate(() => {
        Storage.prototype.setItem = () => {
          throw new Error("Storage blocked");
        };
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async () =>
              await Promise.reject(new Error("Clipboard blocked")),
          },
        });
        // oxlint-disable-next-line typescript/no-deprecated -- exercise the legacy clipboard failure path
        document.execCommand = () => false;
      });
      const comment = '<img src="x" onerror="alert(1)">';
      await addTextComment(page, comment);
      await expect(
        page.locator("[data-annotation-status]").textContent()
      ).resolves.toContain("storage is unavailable");
      await expect(
        page.locator(".mdxr-annotation-card img").count()
      ).resolves.toBe(0);
      await page
        .getByRole("button", { exact: true, name: "Copy Markdown" })
        .click();
      await page
        .getByRole("textbox", { name: "Markdown feedback" })
        .waitFor({ state: "visible" });
      await expect(
        page.getByRole("textbox", { name: "Markdown feedback" }).inputValue()
      ).resolves.toContain(comment);
      await expect(
        page.locator("[data-annotation-status]").textContent()
      ).resolves.toContain("Clipboard access failed");
    } finally {
      await page.close();
    }
  });

  it("fits the review panel on mobile and excludes it from print", async () => {
    const page = await openPage();
    try {
      await page.setViewportSize({ height: 844, width: 390 });
      await addTextComment(page);
      const panel = await page.locator("#mdxr-annotation-panel").boundingBox();
      expect(panel).not.toBeNull();
      expect(panel?.x).toBeGreaterThanOrEqual(0);
      expect((panel?.x ?? 0) + (panel?.width ?? 0)).toBeLessThanOrEqual(390);
      await expect(
        page.evaluate(() => document.documentElement.scrollWidth)
      ).resolves.toBe(390);
      await page.emulateMedia({ media: "print" });
      await expect(
        page.locator("#mdxr-annotations").isVisible()
      ).resolves.toBeFalsy();
    } finally {
      await page.close();
    }
  });
});

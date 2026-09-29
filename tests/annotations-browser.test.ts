import { once } from "node:events";

import { chromium } from "playwright";
import type { Browser, Frame, Locator, Page } from "playwright";
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

const beginTextComment = async (page: Page): Promise<void> => {
  await page.locator("#mdxr-root").click({ position: { x: 5, y: 5 } });
  await selectText(page);
  await page.getByRole("button", { exact: true, name: "Add comment" }).click();
};

const addTextComment = async (
  page: Page,
  comment = "Explain the formatting."
): Promise<void> => {
  await beginTextComment(page);
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

const readContentHash = async (page: Page): Promise<string> =>
  await page.locator("#mdxr-annotation-document").evaluate((element) => {
    const raw = element.textContent;
    if (raw === null) {
      throw new Error("Annotation document metadata missing");
    }
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== "object" ||
      value === null ||
      !("contentHash" in value) ||
      typeof value.contentHash !== "string"
    ) {
      throw new Error("Annotation document content hash missing");
    }
    return value.contentHash;
  });

const readAnnotationStatus = async (locator: Locator): Promise<string | null> =>
  await locator.evaluate((element) =>
    element instanceof HTMLElement ? (element.dataset.status ?? null) : null
  );

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

  const openPage = async (content = html, locale = "en-US"): Promise<Page> => {
    const page = await browser.newPage({
      locale,
      viewport: { height: 850, width: 1280 },
    });
    await page.route("http://mdxr.test/**", async (route) => {
      await route.fulfill({ body: content, contentType: "text/html" });
    });
    await page.goto("http://mdxr.test/review");
    return page;
  };

  it.each([false, true])(
    "adds, edits, records immutable snapshots, and separates text and figure comments (hydrate: %s)",
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
        await page.waitForFunction(
          () =>
            document.querySelector("[data-annotation-status]")?.textContent ===
            "Copied. Recorded in History."
        );
        await page.waitForFunction(
          () =>
            document.querySelectorAll(
              "[data-annotation-list] .mdxr-annotation-card"
            ).length === 2
        );
        await page.reload();
        await page.getByRole("button", { name: "Annotate" }).click();
        const history = page.locator("[data-annotation-history]");
        await history.locator(":scope > summary").click();
        const historyBatch = page.locator(
          "[data-annotation-history-list] details[data-annotation-batch]"
        );
        await historyBatch.locator(":scope > summary").click();
        const restoredHistory = await page.evaluate(() => {
          const historyList = document.querySelector<HTMLElement>(
            "[data-annotation-history-list]"
          );
          const batchSummary = historyList?.querySelector("summary");
          const date = historyList?.querySelector("time[datetime]");
          const historyText = historyList?.textContent ?? "";
          return {
            activeCount: document.querySelectorAll(
              "[data-annotation-list] .mdxr-annotation-card"
            ).length,
            batchCount: historyList?.querySelectorAll(
              "details[data-annotation-batch]"
            ).length,
            copyAction: batchSummary?.textContent?.includes("Copied Markdown"),
            dateStored: Boolean(date?.getAttribute("datetime")),
            entryCount: historyList?.querySelectorAll(
              ".mdxr-annotation-history-entry"
            ).length,
            readOnlyControls: historyList?.querySelectorAll(
              "button, input, textarea"
            ).length,
            retainsComments:
              historyText.includes("例を追加してください。") &&
              historyText.includes("Label the arrows."),
          };
        });
        expect(restoredHistory).toStrictEqual({
          activeCount: 2,
          batchCount: 1,
          copyAction: true,
          dateStored: true,
          entryCount: 2,
          readOnlyControls: 0,
          retainsComments: true,
        });
        await addTextComment(page, "A later note.");
        const separatedNotes = await page.evaluate(() => ({
          activeComments: Array.from(
            document.querySelectorAll(
              "[data-annotation-list] .mdxr-annotation-comment-body"
            ),
            (comment) => comment.textContent
          ),
          batchCount: document.querySelectorAll(
            "[data-annotation-history-list] details[data-annotation-batch]"
          ).length,
          historyCount: document.querySelector(
            "[data-annotation-history-count]"
          )?.textContent,
        }));
        expect(separatedNotes).toStrictEqual({
          activeComments: [
            "例を追加してください。",
            "Label the arrows.",
            "A later note.",
          ],
          batchCount: 1,
          historyCount: "1",
        });
        const deleteButtons = page.getByRole("button", {
          exact: true,
          name: "Delete",
        });
        await deleteButtons.first().click();
        await deleteButtons.first().click();
        await deleteButtons.first().click();
        await page.waitForFunction(
          () =>
            document.querySelectorAll(
              "[data-annotation-list] .mdxr-annotation-card"
            ).length === 0
        );
        await page.getByRole("button", { name: "Close annotations" }).click();
        await page.getByText("More details", { exact: true }).click();
        const finalState = {
          activeCount: await page
            .locator("[data-annotation-list] .mdxr-annotation-card")
            .count(),
          detailsOpen:
            (await page
              .locator("#mdxr-root details")
              .first()
              .getAttribute("open")) !== null,
          errors,
          historyCount: await page
            .locator(
              "[data-annotation-history-list] details[data-annotation-batch]"
            )
            .count(),
        };
        expect(finalState).toStrictEqual({
          activeCount: 0,
          detailsOpen: true,
          errors: [],
          historyCount: 1,
        });
      } finally {
        await page.close();
      }
    }
  );

  it("records the sent snapshot and keeps comments edited in flight", async () => {
    const page = await browser.newPage({
      viewport: { height: 850, width: 1280 },
    });
    const submitted: string[] = [];
    const handoff = new EventTarget();
    const requestReceived = once(handoff, "request");
    const responseReleased = once(handoff, "release");
    const agentHtml = html.replace(
      "</body>",
      "<div data-mdxr-agent hidden></div></body>"
    );
    await page.route("http://mdxr.test/**", async (route) => {
      if (new URL(route.request().url()).pathname === "/__mdxr_agent") {
        const body = route.request().postData();
        if (body !== null) {
          const value: unknown = JSON.parse(body);
          if (
            typeof value === "object" &&
            value !== null &&
            "message" in value &&
            typeof value.message === "string"
          ) {
            submitted.push(value.message);
          }
        }
        if (route.request().method() === "POST") {
          handoff.dispatchEvent(new Event("request"));
          await responseReleased;
        }
        await route.fulfill({
          body: JSON.stringify({
            busy: false,
            messages: [],
            provider: "codex",
          }),
          contentType: "application/json",
        });
        return;
      }
      await route.fulfill({ body: agentHtml, contentType: "text/html" });
    });
    await page.goto("http://mdxr.test/review");
    try {
      await addTextComment(page, "Send these notes.");
      const sendButton = page.getByRole("button", { name: "Send to chat" });
      await expect(sendButton.isVisible()).resolves.toBeTruthy();
      await sendButton.click();
      await requestReceived;
      await addTextComment(page, "Created while sending.");
      await page
        .getByRole("button", { exact: true, name: "Edit" })
        .first()
        .click();
      await page
        .getByRole("textbox", { exact: true, name: "Comment" })
        .fill("Edited while sending.");
      await page
        .getByRole("button", { exact: true, name: "Save changes" })
        .click();
      await beginTextComment(page);
      await page
        .getByRole("textbox", { exact: true, name: "Comment" })
        .fill("Draft kept while sending.");
      handoff.dispatchEvent(new Event("release"));
      await page.waitForFunction(
        () =>
          document.querySelector("[data-annotation-status]")?.textContent ===
          "Sent. Recorded in History."
      );
      await expect(
        page.getByRole("textbox", { exact: true, name: "Comment" }).inputValue()
      ).resolves.toBe("Draft kept while sending.");
      await page.getByRole("button", { exact: true, name: "Cancel" }).click();
      await page.reload();
      await page.getByRole("button", { name: "Annotate" }).click();
      const history = page.locator("[data-annotation-history]");
      await history.locator(":scope > summary").click();
      const historyBatch = page.locator(
        "[data-annotation-history-list] details[data-annotation-batch]"
      );
      await historyBatch.locator(":scope > summary").click();
      const savedState = await page.evaluate(() => {
        const historyList = document.querySelector<HTMLElement>(
          "[data-annotation-history-list]"
        );
        const historyText = historyList?.textContent ?? "";
        const summary = historyList?.querySelector("summary")?.textContent;
        return {
          activeComments: Array.from(
            document.querySelectorAll(
              "[data-annotation-list] .mdxr-annotation-comment-body"
            ),
            (comment) => comment.textContent
          ),
          batchCount: historyList?.querySelectorAll(
            "details[data-annotation-batch]"
          ).length,
          dateStored: Boolean(
            historyList
              ?.querySelector("time[datetime]")
              ?.getAttribute("datetime")
          ),
          historyContainsSentSnapshot:
            historyText.includes("Send these notes.") &&
            !historyText.includes("Created while sending.") &&
            !historyText.includes("Edited while sending."),
          sendAction: summary?.includes("Sent to chat"),
        };
      });
      expect({
        savedState,
        submittedSnapshot: {
          count: submitted.length,
          excludesInFlightComment: !submitted[0]?.includes(
            "Created while sending."
          ),
          hasQuote: submitted[0]?.includes("> rich text"),
          hasSentComment: submitted[0]?.includes("Send these notes."),
        },
      }).toStrictEqual({
        savedState: {
          activeComments: ["Edited while sending.", "Created while sending."],
          batchCount: 1,
          dateStored: true,
          historyContainsSentSnapshot: true,
          sendAction: true,
        },
        submittedSnapshot: {
          count: 1,
          excludesInFlightComment: true,
          hasQuote: true,
          hasSentComment: true,
        },
      });
    } finally {
      handoff.dispatchEvent(new Event("release"));
      await page.close();
    }
  });

  it("keeps comments active when sending to chat fails", async () => {
    const page = await browser.newPage({
      viewport: { height: 850, width: 1280 },
    });
    const agentHtml = html.replace(
      "</body>",
      "<div data-mdxr-agent hidden></div></body>"
    );
    await page.route("http://mdxr.test/**", async (route) => {
      if (new URL(route.request().url()).pathname === "/__mdxr_agent") {
        if (route.request().method() === "POST") {
          await route.fulfill({
            body: JSON.stringify({ error: "Agent offline" }),
            contentType: "application/json",
            status: 503,
          });
          return;
        }
        await route.fulfill({
          body: JSON.stringify({
            busy: false,
            messages: [],
            provider: "codex",
          }),
          contentType: "application/json",
        });
        return;
      }
      await route.fulfill({ body: agentHtml, contentType: "text/html" });
    });
    await page.goto("http://mdxr.test/review");
    try {
      await addTextComment(page, "Keep this comment if sending fails.");
      const sendButton = page.getByRole("button", { name: "Send to chat" });
      await sendButton.waitFor({ state: "visible" });
      await sendButton.click();
      await page.waitForFunction(
        () =>
          document.querySelector("[data-annotation-status]")?.textContent ===
          "Could not send annotations: Agent offline"
      );
      await page.reload();
      await page.getByRole("button", { name: "Annotate" }).click();
      const failureState = await page.evaluate(() => ({
        activeComments: Array.from(
          document.querySelectorAll(
            "[data-annotation-list] .mdxr-annotation-comment-body"
          ),
          (comment) => comment.textContent
        ),
        historyBatches: document.querySelectorAll(
          "[data-annotation-history-list] details[data-annotation-batch]"
        ).length,
        historyHidden: document
          .querySelector<HTMLElement>("[data-annotation-history]")
          ?.hasAttribute("hidden"),
      }));
      expect(failureState).toStrictEqual({
        activeComments: ["Keep this comment if sending fails."],
        historyBatches: 0,
        historyHidden: true,
      });
    } finally {
      await page.close();
    }
  });

  it("localizes comment status, filtering, reopening, and open-only copy in Japanese", async () => {
    const page = await openPage(html, "ja-JP");
    try {
      await clipboardStub(page);
      await page.locator("[data-annotation-toggle]").click();
      const initialLabels = {
        filter: await page
          .locator("[data-annotation-filter]")
          .getAttribute("aria-label"),
        resolved: await page
          .locator("[data-annotation-filter] option[value='resolved']")
          .textContent(),
        toggle: await page
          .locator("[data-annotation-toggle]")
          .getAttribute("aria-label"),
      };

      const addJapaneseComment = async (comment: string): Promise<void> => {
        await page.locator("#mdxr-root").click({ position: { x: 5, y: 5 } });
        await selectText(page);
        await page
          .getByRole("button", { exact: true, name: "コメントを追加" })
          .click();
        await page
          .getByRole("textbox", { exact: true, name: "コメント" })
          .fill(comment);
        await page
          .getByRole("button", { exact: true, name: "コメントを保存" })
          .click();
      };
      const resolvedComment = "対応内容を確認してください。";
      const openComment = "このコメントは未対応のままです。";
      await addJapaneseComment(resolvedComment);
      await addJapaneseComment(openComment);

      const firstCard = page.locator(".mdxr-annotation-card").first();
      await firstCard.locator('[data-annotation-action="resolve"]').click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>(".mdxr-annotation-card")?.dataset
            .status === "resolved"
      );
      const resolvedCardText = await firstCard.textContent();
      const resolvedCardState = {
        count: await page.locator("[data-annotation-count]").textContent(),
        hasRevision: resolvedCardText?.includes("記録したリビジョン:"),
        hasStatus: resolvedCardText?.includes("対応済み"),
        status: await readAnnotationStatus(firstCard),
      };

      await page.locator("[data-annotation-copy]").click();
      await page.waitForFunction(
        () =>
          document.querySelector("[data-annotation-status]")?.textContent ===
          "コピーしました。履歴に記録しました。"
      );
      const copiedMarkdown = await page
        .locator("html")
        .getAttribute("data-feedback");
      const copiedOpenOnly = {
        hasOpenComment: copiedMarkdown?.includes(openComment),
        hasResolvedComment: copiedMarkdown?.includes(resolvedComment),
        status: await page.locator("[data-annotation-status]").textContent(),
      };

      const filter = page.locator("[data-annotation-filter]");
      await filter.selectOption("open");
      const openCount = await page.locator(".mdxr-annotation-card").count();
      await filter.selectOption("resolved");
      const resolvedCount = await page.locator(".mdxr-annotation-card").count();
      await filter.selectOption("all");
      const resolvedCard = page.locator(".mdxr-annotation-card").first();
      await resolvedCard.locator('[data-annotation-action="reopen"]').click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>(".mdxr-annotation-card")?.dataset
            .status === "open"
      );
      const reopenedState = {
        cardStatus: await readAnnotationStatus(resolvedCard),
        message: await page.locator("[data-annotation-status]").textContent(),
      };

      await resolvedCard.locator('[data-annotation-action="resolve"]').click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>(".mdxr-annotation-card")?.dataset
            .status === "resolved"
      );
      await filter.selectOption("resolved");
      await resolvedCard
        .getByRole("button", { exact: true, name: "編集" })
        .click();
      await page
        .getByRole("textbox", { exact: true, name: "コメント" })
        .fill("内容を更新したので未対応に戻します。");
      await page
        .getByRole("button", { exact: true, name: "変更を保存" })
        .click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>(".mdxr-annotation-card")?.dataset
            .status === "open"
      );
      expect({
        copiedOpenOnly,
        filterCounts: { open: openCount, resolved: resolvedCount },
        finalEditState: {
          cardStatus: await readAnnotationStatus(
            page.locator(".mdxr-annotation-card").first()
          ),
          filter: await filter.inputValue(),
          message: await page.locator("[data-annotation-status]").textContent(),
        },
        initialLabels,
        reopenedState,
        resolvedCardState,
      }).toStrictEqual({
        copiedOpenOnly: {
          hasOpenComment: true,
          hasResolvedComment: false,
          status: "コピーしました。履歴に記録しました。",
        },
        filterCounts: { open: 1, resolved: 1 },
        finalEditState: {
          cardStatus: "open",
          filter: "open",
          message: "このブラウザーに保存しました",
        },
        initialLabels: {
          filter: "コメントを絞り込む",
          resolved: "対応済み",
          toggle: "コメント",
        },
        reopenedState: {
          cardStatus: "open",
          message: "未対応に戻しました。",
        },
        resolvedCardState: {
          count: "1",
          hasRevision: true,
          hasStatus: true,
          status: "resolved",
        },
      });
    } finally {
      await page.close();
    }
  });

  it("links the matching historical version and warns after the document changes", async () => {
    const withWorkspace = html.replace(
      "</body>",
      '<div id="mdxr-workspace-root" hidden></div></body>'
    );
    const page = await openPage(withWorkspace);
    try {
      await addTextComment(page, "Resolve against the rendered version.");
      const contentHash = await readContentHash(page);
      const matchedVersion = {
        contentHash,
        createdAt: "2026-09-29T10:00:00.000Z",
        id: "11111111-1111-4111-8111-111111111111",
        sequence: 2,
      };
      const laterVersion = {
        contentHash: "0".repeat(64),
        createdAt: "2026-09-30T10:00:00.000Z",
        id: "22222222-2222-4222-8222-222222222222",
        sequence: 3,
      };
      await page.route("**/__mdxr_history", async (route) => {
        await route.fulfill({
          body: JSON.stringify({ versions: [matchedVersion, laterVersion] }),
          contentType: "application/json",
        });
      });
      await page.getByRole("button", { name: "Mark as resolved" }).click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>(".mdxr-annotation-card")?.dataset
            .status === "resolved"
      );
      const originalLink = page.locator(".mdxr-annotation-version-link");
      const originalHref = await originalLink.getAttribute("href");
      if (originalHref === null) {
        throw new Error("Resolved version link is missing");
      }
      const originalVersionLink = {
        id: new URL(originalHref).searchParams.get("id"),
        label: await originalLink.textContent(),
        rel: await originalLink.getAttribute("rel"),
        target: await originalLink.getAttribute("target"),
      };

      const changedDocument = await render(
        `${SOURCE}\n\n## Follow-up\n\nA later document revision.\n`,
        { filePath: "/project/review.mdx" }
      );
      await page.route("http://mdxr.test/updated", async (route) => {
        await route.fulfill({
          body: changedDocument,
          contentType: "text/html",
        });
      });
      await page.goto("http://mdxr.test/updated");
      await page.locator("[data-annotation-toggle]").click();
      const updatedWarning = await page
        .locator(".mdxr-annotation-updated-warning")
        .textContent();
      const restoredLink = page.locator(".mdxr-annotation-version-link");
      const restoredHref = await restoredLink.getAttribute("href");
      if (restoredHref === null) {
        throw new Error("Restored version link is missing");
      }
      const restoredVersionId = new URL(restoredHref).searchParams.get("id");
      expect({
        originalVersionLink,
        restoredVersionId,
        updatedWarning,
      }).toStrictEqual({
        originalVersionLink: {
          id: matchedVersion.id,
          label: "View corrected version · #2",
          rel: "noopener noreferrer",
          target: "_blank",
        },
        restoredVersionId: matchedVersion.id,
        updatedWarning:
          "The document has changed. Review this comment again before considering it resolved.",
      });
    } finally {
      await page.close();
    }
  });

  it("keeps a comment open after a history error and allows retry", async () => {
    const withWorkspace = html.replace(
      "</body>",
      '<div id="mdxr-workspace-root" hidden></div></body>'
    );
    const page = await openPage(withWorkspace);
    let attempts = 0;
    try {
      await addTextComment(page, "Retry version lookup.");
      const contentHash = await readContentHash(page);
      await page.route("**/__mdxr_history", async (route) => {
        attempts += 1;
        if (attempts === 1) {
          await route.fulfill({
            body: JSON.stringify({ error: "Unavailable" }),
            contentType: "application/json",
            status: 503,
          });
          return;
        }
        await route.fulfill({
          body: JSON.stringify({
            versions: [
              {
                contentHash,
                createdAt: "2026-09-30T10:00:00.000Z",
                id: "33333333-3333-4333-8333-333333333333",
                sequence: 1,
              },
            ],
          }),
          contentType: "application/json",
        });
      });

      const resolveButton = page.getByRole("button", {
        name: "Mark as resolved",
      });
      await resolveButton.click();
      await page.waitForFunction(
        () =>
          document.querySelector("[data-annotation-status]")?.textContent ===
          "Could not record the resolved version. Reload the document and try again."
      );
      await expect(
        readAnnotationStatus(page.locator(".mdxr-annotation-card").first())
      ).resolves.toBe("open");
      await resolveButton.click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>(".mdxr-annotation-card")?.dataset
            .status === "resolved"
      );
      expect(attempts).toBe(2);
    } finally {
      await page.close();
    }
  });

  it("migrates v1 archived comments as independent active copies", async () => {
    const page = await openPage();
    try {
      await clipboardStub(page);
      await addTextComment(page, "Original archived snapshot.");
      await page.getByRole("button", { name: "Copy Markdown" }).click();
      await page.waitForFunction(
        () =>
          document.querySelector("[data-annotation-status]")?.textContent ===
          "Copied. Recorded in History."
      );
      await page.evaluate(() => {
        const key = "mdxr:annotations:v1:/project/review.mdx";
        const raw = localStorage.getItem(key);
        if (raw === null) {
          throw new Error("Saved annotation store missing");
        }
        const value: unknown = JSON.parse(raw);
        if (
          typeof value !== "object" ||
          value === null ||
          !("annotations" in value) ||
          !Array.isArray(value.annotations) ||
          !("history" in value) ||
          !Array.isArray(value.history) ||
          !("version" in value)
        ) {
          throw new Error("Saved annotation store is invalid");
        }
        value.version = 1;
        value.annotations = [];
        localStorage.setItem(key, JSON.stringify(value));
      });
      await page.reload();
      await page.locator("[data-annotation-toggle]").click();
      await expect(page.locator(".mdxr-annotation-card").count()).resolves.toBe(
        1
      );
      await page.getByRole("button", { exact: true, name: "Edit" }).click();
      await page
        .getByRole("textbox", { exact: true, name: "Comment" })
        .fill("Edited after migration.");
      await page
        .getByRole("button", { exact: true, name: "Save changes" })
        .click();
      const history = page.locator("[data-annotation-history]");
      await history.locator(":scope > summary").click();
      const batch = page.locator(
        "[data-annotation-history-list] details[data-annotation-batch]"
      );
      await batch.locator(":scope > summary").click();
      await expect(
        page.locator(".mdxr-annotation-comment-body").textContent()
      ).resolves.toBe("Edited after migration.");
      await expect(
        page.locator(".mdxr-annotation-history-list").textContent()
      ).resolves.toContain("Original archived snapshot.");
      await expect(
        page.locator(".mdxr-annotation-history-list").textContent()
      ).resolves.not.toContain("Edited after migration.");
    } finally {
      await page.close();
    }
  });

  it("keeps an edit draft when a different tab changes the saved comment", async () => {
    const page = await openPage();
    try {
      await addTextComment(page, "Original shared comment.");
      await page.getByRole("button", { exact: true, name: "Edit" }).click();
      const draftInput = page.getByRole("textbox", {
        exact: true,
        name: "Comment",
      });
      await draftInput.fill("My local draft.");
      await page.evaluate(() => {
        const key = "mdxr:annotations:v1:/project/review.mdx";
        const raw = localStorage.getItem(key);
        if (raw === null) {
          throw new Error("Saved annotation store missing");
        }
        const value: unknown = JSON.parse(raw);
        if (
          typeof value !== "object" ||
          value === null ||
          !("annotations" in value) ||
          !Array.isArray(value.annotations)
        ) {
          throw new Error("Saved annotation is invalid");
        }
        const firstAnnotation: unknown = value.annotations[0];
        if (
          typeof firstAnnotation !== "object" ||
          firstAnnotation === null ||
          !("comment" in firstAnnotation) ||
          typeof firstAnnotation.comment !== "string"
        ) {
          throw new Error("Saved annotation is invalid");
        }
        firstAnnotation.comment = "Changed in another tab.";
        const newValue = JSON.stringify(value);
        localStorage.setItem(key, newValue);
        window.dispatchEvent(
          new StorageEvent("storage", {
            key,
            newValue,
            storageArea: localStorage,
          })
        );
      });
      await expect(
        page.locator(".mdxr-annotation-comment-body").textContent()
      ).resolves.toBe("Changed in another tab.");
      await page
        .getByRole("button", { exact: true, name: "Save changes" })
        .click();
      await expect(
        page.locator("[data-annotation-status]").textContent()
      ).resolves.toBe(
        "This comment changed in another tab. Copy your draft, then edit it again."
      );
      await expect(draftInput.inputValue()).resolves.toBe("My local draft.");
      await expect(
        page.locator(".mdxr-annotation-comment-body").textContent()
      ).resolves.toBe("Changed in another tab.");
    } finally {
      await page.close();
    }
  });

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
        const history = restored.locator("[data-annotation-history]");
        const storageAvailable = sandbox.includes("allow-same-origin");
        if (storageAvailable) {
          await history.locator(":scope > summary").click();
          const batch = restored.locator(
            "[data-annotation-history-list] details[data-annotation-batch]"
          );
          await batch.locator(":scope > summary").click();
        }
        const restoredState = await restored.locator("html").evaluate(() => {
          const historyList = document.querySelector<HTMLElement>(
            "[data-annotation-history-list]"
          );
          return {
            activeComments: Array.from(
              document.querySelectorAll(
                "[data-annotation-list] .mdxr-annotation-comment-body"
              ),
              (comment) => comment.textContent
            ),
            archivedComment:
              historyList?.textContent?.includes("更新したコメント"),
            historyBatchCount: historyList?.querySelectorAll(
              "details[data-annotation-batch]"
            ).length,
            historyHidden: document
              .querySelector<HTMLElement>("[data-annotation-history]")
              ?.hasAttribute("hidden"),
          };
        });
        expect({ errors, restoredState }).toStrictEqual({
          errors: [],
          restoredState: {
            activeComments: storageAvailable ? ["更新したコメント"] : [],
            archivedComment: storageAvailable,
            historyBatchCount: storageAvailable ? 1 : 0,
            historyHidden: !storageAvailable,
          },
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
      await page.waitForFunction(() =>
        document
          .querySelector("[data-annotation-status]")
          ?.textContent?.includes("storage is unavailable")
      );
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
      const clipboardFailure = await page.evaluate(() => ({
        activeCount: document.querySelectorAll(
          "[data-annotation-list] .mdxr-annotation-card"
        ).length,
        historyHidden: document
          .querySelector<HTMLElement>("[data-annotation-history]")
          ?.hasAttribute("hidden"),
        status: document.querySelector("[data-annotation-status]")?.textContent,
      }));
      expect(clipboardFailure).toStrictEqual({
        activeCount: 1,
        historyHidden: true,
        status: "Clipboard access failed. Copy the selected Markdown below.",
      });
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

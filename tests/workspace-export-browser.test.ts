import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { injectAgentPreview } from "../src/agent-preview.js";
import type { DocumentDiffLine } from "../src/document-history.js";
import { render } from "../src/render.js";
import type { WorkspaceExportData } from "../src/workspace-export-data.js";
import { workspaceJs } from "../src/workspace-js.js";

const FILE_PATH = "/project/export-review.mdx";
const OFFLINE_IMAGE =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PC9zdmc+";
const BEFORE_SOURCE = `# Export review

## Design

This is the original review snapshot.

The quote to comment on is export snapshot marker.
`;
const AFTER_SOURCE = `# Export review

## Design

This is the current review snapshot.

The quote to comment on is export snapshot marker.

![Offline snapshot](${OFFLINE_IMAGE})

<textarea aria-label="Document note" defaultValue="Initial note" />
`;
const MALICIOUS_TEXT =
  '</script><img src=x onerror="window.__mdxrExportPwned=true">';
const COMMENT_TEXT = `Review safely: ${MALICIOUS_TEXT}`;
const CLIPBOARD_WRITE = Promise.resolve();
const CHAT_MESSAGES = [
  { content: "Please preserve both document versions.", role: "user" },
  { content: `Here is a note: ${MALICIOUS_TEXT}`, role: "assistant" },
] as const;
const DIFF: DocumentDiffLine[] = [
  { text: "# Export review", type: "context" },
  { text: "", type: "context" },
  { text: "## Design", type: "context" },
  { text: "", type: "context" },
  { text: "This is the original review snapshot.", type: "remove" },
  { text: "This is the current review snapshot.", type: "add" },
];
const VERSIONS = [
  {
    contentHash: "a".repeat(64),
    createdAt: "2026-09-27T08:00:00.000Z",
    id: "v1",
    kind: "initial",
    sequence: 1,
    size: BEFORE_SOURCE.length,
  },
  {
    contentHash: "b".repeat(64),
    createdAt: "2026-09-27T08:05:00.000Z",
    id: "v2",
    kind: "change",
    sequence: 2,
    size: AFTER_SOURCE.length,
  },
] as const;

const EXPORT_DATA: WorkspaceExportData = {
  conversation: {
    busy: false,
    messages: [...CHAT_MESSAGES],
    provider: "codex",
    sessionId: "export-session",
  },
  exportedAt: "2026-09-27T08:10:00.000Z",
  file: FILE_PATH,
  latestId: "v2",
  versions: [
    { ...VERSIONS[0], diff: [], source: BEFORE_SOURCE },
    { ...VERSIONS[1], diff: DIFF, source: AFTER_SOURCE },
  ],
};

const EXPORT_BUTTON = { exact: true, name: "Export HTML" } as const;

const responseJson = (body: unknown): string => JSON.stringify(body);

const openWorkspace = async (
  browser: Browser,
  html: string,
  script: string,
  width = 1280,
  exportResponse: (attempt: number) => unknown = () => EXPORT_DATA
): Promise<{ page: Page; exportAttempts: () => number }> => {
  let attempts = 0;
  const page = await browser.newPage({ viewport: { height: 900, width } });
  page.setDefaultNavigationTimeout(15_000);
  page.setDefaultTimeout(5000);
  await page.route("http://mdxr.test/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/__mdxr_workspace.js") {
      await route.fulfill({ body: script, contentType: "text/javascript" });
      return;
    }
    if (url.pathname === "/__mdxr_events") {
      await route.fulfill({
        body: "retry: 60000\nevent: agent\ndata: {}\n\n",
        headers: {
          "cache-control": "no-cache",
          "content-type": "text/event-stream",
        },
      });
      return;
    }
    if (url.pathname === "/__mdxr_agent") {
      await route.fulfill({
        body: responseJson({
          busy: false,
          messages: CHAT_MESSAGES,
          provider: "codex",
          sessionId: "export-session",
        }),
        contentType: "application/json",
      });
      return;
    }
    if (url.pathname === "/__mdxr_history") {
      const view = url.searchParams.get("view");
      if (view === "source") {
        const id = url.searchParams.get("id");
        await route.fulfill({
          body: responseJson({
            id,
            source: id === "v1" ? BEFORE_SOURCE : AFTER_SOURCE,
          }),
          contentType: "application/json",
        });
        return;
      }
      if (view === "diff") {
        await route.fulfill({
          body: responseJson({
            from: url.searchParams.get("from"),
            lines: DIFF,
            to: url.searchParams.get("to"),
          }),
          contentType: "application/json",
        });
        return;
      }
      await route.fulfill({
        body: responseJson({ latestId: "v2", versions: VERSIONS }),
        contentType: "application/json",
      });
      return;
    }
    if (url.pathname === "/__mdxr_export") {
      attempts += 1;
      const body = exportResponse(attempts);
      const status =
        typeof body === "object" &&
        body !== null &&
        "status" in body &&
        typeof body.status === "number"
          ? body.status
          : 200;
      const responseBody =
        typeof body === "object" && body !== null && "body" in body
          ? body.body
          : body;
      await route.fulfill({
        body: responseJson(responseBody),
        contentType: "application/json",
        status,
      });
      return;
    }
    await route.fulfill({ body: html, contentType: "text/html" });
  });
  await page.goto("http://mdxr.test/review");
  await page.locator(".mdxr-workspace-tabs").waitFor({ state: "visible" });
  await page.getByRole("button", EXPORT_BUTTON).waitFor({ state: "visible" });
  return { exportAttempts: () => attempts, page };
};

const selectText = async (page: Page, quote: string): Promise<void> => {
  await page.evaluate((selectedText) => {
    const root = document.querySelector("#mdxr-root");
    if (root === null) {
      throw new Error("Document root is missing");
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node !== null) {
      const start = node.textContent?.indexOf(selectedText) ?? -1;
      if (start >= 0) {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + selectedText.length);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
        return;
      }
      node = walker.nextNode();
    }
    throw new Error(`Text not found: ${selectedText}`);
  }, quote);
};

const addComment = async (
  page: Page,
  comment = COMMENT_TEXT,
  quote = "export snapshot marker"
): Promise<void> => {
  await selectText(page, quote);
  await page.getByRole("button", { exact: true, name: "Add comment" }).click();
  await page
    .getByRole("textbox", { exact: true, name: "Comment" })
    .fill(comment);
  await page.getByRole("button", { exact: true, name: "Save comment" }).click();
};

const disableAnnotationStorageAndStubClipboard = async (
  page: Page
): Promise<void> => {
  await page.evaluate(() => {
    const storage = window.localStorage;
    const originalSetItem = storage.setItem.bind(storage);
    Object.defineProperty(storage, "setItem", {
      configurable: true,
      value: (key: string, value: string) => {
        if (key.startsWith("mdxr:annotations:")) {
          throw new Error("Browser storage unavailable for this test");
        }
        originalSetItem(key, value);
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          await CLIPBOARD_WRITE;
        },
      },
    });
  });
};

const toggleSectionReview = async (page: Page): Promise<void> => {
  const firstReview = page.locator("mdxr-section-review").first();
  await firstReview.waitFor({ state: "attached" });
  await firstReview.evaluate((element) => {
    const button = element.shadowRoot?.querySelector("button");
    if (button === null || button === undefined) {
      throw new Error("Section review button is missing");
    }
    button.click();
  });
};

describe("workspace HTML export", () => {
  let browser: Browser;
  let html: string;
  let script: string;

  beforeAll(async () => {
    browser = await chromium.launch();
    html = injectAgentPreview(
      await render(AFTER_SOURCE, { filePath: FILE_PATH }),
      "codex"
    );
    script = await workspaceJs();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it("downloads a self-contained archive with the document, chat, comments, and complete history", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mdxr-export-"));
    const maliciousMessage = CHAT_MESSAGES[1].content;
    const { page, exportAttempts } = await openWorkspace(
      browser,
      html,
      script,
      1280,
      (attempt) =>
        attempt === 1
          ? { body: { error: "Temporary export failure" }, status: 503 }
          : EXPORT_DATA
    );
    let offlineContext: Awaited<ReturnType<Browser["newContext"]>> | undefined;
    try {
      await addComment(page);
      await toggleSectionReview(page);
      await page
        .getByRole("textbox", { name: "Document note" })
        .fill("Edited in browser");
      await page.getByRole("button", { name: "Open agent chat" }).click();
      const composer = page.getByRole("textbox", { name: "Message to agent" });
      await composer.fill("Unsent chat draft <keep me>");
      await page.getByText("Please preserve both document versions.").waitFor({
        state: "visible",
      });

      const exportButton = page.getByRole("button", EXPORT_BUTTON);
      await exportButton.click();
      const error = page.getByRole("alert");
      await error.waitFor({ state: "visible" });
      const errorText = await error.textContent();
      const firstAttempt = {
        alerted: errorText?.includes("Temporary export failure"),
        attempts: exportAttempts(),
      };
      expect(firstAttempt).toStrictEqual({ alerted: true, attempts: 1 });

      const downloadPromise = page.waitForEvent("download");
      await exportButton.click();
      const download = await downloadPromise;
      const archivePath = path.join(tempDir, download.suggestedFilename());
      await download.saveAs(archivePath);
      expect({ attempts: exportAttempts(), downloaded: true }).toStrictEqual({
        attempts: 2,
        downloaded: true,
      });

      offlineContext = await browser.newContext();
      const blockedRequests: string[] = [];
      await offlineContext.route(/^https?:\/\//u, async (route) => {
        blockedRequests.push(route.request().url());
        await route.abort();
      });
      const archivePage = await offlineContext.newPage();
      await archivePage.goto(pathToFileURL(archivePath).href);
      const sectionIds = await archivePage
        .locator(".mdxr-export")
        .evaluate((exportRoot) =>
          Array.from(
            exportRoot.querySelectorAll(":scope > section"),
            ({ id }) => id
          )
        );
      const appendixInsideRoot =
        (await archivePage.locator("#mdxr-root > .mdxr-export").count()) === 1;
      const iframeCount = await archivePage.locator("iframe").count();
      const snapshotNote = await archivePage
        .locator('textarea[aria-label="Document note"]')
        .inputValue();
      const snapshotImage = await archivePage
        .locator('img[alt="Offline snapshot"]')
        .getAttribute("src");
      const archiveTitle = await archivePage.title();
      const archiveText = await archivePage.locator("main").textContent();
      const exportDataText = await archivePage
        .locator("script#mdxr-export-data[type='application/json']")
        .textContent();
      const scriptCount = await archivePage.locator("body script").count();
      const activeInjectedImages = await archivePage
        .locator("#chat img, #comments img")
        .count();
      const injectedScripts = await archivePage
        .locator("#chat script, #comments script")
        .count();

      expect({
        hasAllArchiveSections:
          appendixInsideRoot &&
          iframeCount === 0 &&
          archiveTitle.endsWith("Workspace archive") &&
          sectionIds.join(",") === "chat,comments,reviews,history",
        hasDocumentChatCommentAndDiff: [
          "This is the original review snapshot.",
          "This is the current review snapshot.",
          "− This is the original review snapshot.",
          "+ This is the current review snapshot.",
          "Please preserve both document versions.",
          maliciousMessage,
          COMMENT_TEXT,
          "Unsent chat draft <keep me>",
          "Design — Reviewed",
        ].every((expected) => archiveText?.includes(expected) === true),
        hasEmbeddedSnapshot: archiveText?.includes("export snapshot marker"),
        preservesBrowserDocumentState:
          snapshotNote === "Edited in browser" &&
          (snapshotImage?.startsWith("data:image/svg+xml;base64,") ?? false),
      }).toStrictEqual({
        hasAllArchiveSections: true,
        hasDocumentChatCommentAndDiff: true,
        hasEmbeddedSnapshot: true,
        preservesBrowserDocumentState: true,
      });
      expect({
        blockedRequests,
        hasEscapedJson: exportDataText?.includes("\\u003c/script>") ?? false,
        injectedImages: activeInjectedImages,
        injectedScripts,
        scriptCount,
      }).toStrictEqual({
        blockedRequests: [],
        hasEscapedJson: true,
        injectedImages: 0,
        injectedScripts: 0,
        scriptCount: 1,
      });

      if (exportDataText === null) {
        throw new Error("Export data is missing from the archive");
      }
      const data: unknown = JSON.parse(exportDataText);
      expect(data).toMatchObject({
        browser: {
          annotations: { annotations: [{ comment: COMMENT_TEXT }] },
          chatDraft: "Unsent chat draft <keep me>",
          sectionReviews: [
            expect.objectContaining({ reviewed: true, title: "Design" }),
          ],
        },
        version: 1,
        workspace: {
          conversation: { messages: [...CHAT_MESSAGES] },
          versions: [
            { diff: [], source: BEFORE_SOURCE },
            { diff: DIFF, source: AFTER_SOURCE },
          ],
        },
      });

      await archivePage.close();
    } finally {
      await offlineContext?.close();
      await page.close();
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("retains comment history and an unsent comment draft when browser storage is unavailable", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "mdxr-export-draft-"));
    const { page } = await openWorkspace(browser, html, script);
    let offlineContext: Awaited<ReturnType<Browser["newContext"]>> | undefined;
    try {
      await disableAnnotationStorageAndStubClipboard(page);
      await addComment(page, "Archived before storage failed.");
      const storageStatus = page.locator("[data-annotation-status]");
      await storageStatus.waitFor({ state: "visible" });
      const storageWarning = await storageStatus.textContent();
      await page.getByRole("button", { name: "Copy Markdown" }).click();
      await page.waitForFunction(() =>
        document
          .querySelector("[data-annotation-status]")
          ?.textContent?.includes("History is available until this page closes")
      );

      await selectText(
        page,
        "The quote to comment on is export snapshot marker."
      );
      await page
        .getByRole("button", { exact: true, name: "Add comment" })
        .click();
      await page
        .getByRole("textbox", { exact: true, name: "Comment" })
        .fill("A note still being written.");

      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", EXPORT_BUTTON).click();
      const download = await downloadPromise;
      const archivePath = path.join(tempDir, download.suggestedFilename());
      await download.saveAs(archivePath);

      offlineContext = await browser.newContext();
      await offlineContext.route(/^https?:\/\//u, async (route) => {
        await route.abort();
      });
      const archivePage = await offlineContext.newPage();
      await archivePage.goto(pathToFileURL(archivePath).href);
      const archiveText = await archivePage.locator("#comments").textContent();
      const exportDataText = await archivePage
        .locator("script#mdxr-export-data[type='application/json']")
        .textContent();
      if (exportDataText === null) {
        throw new Error("Export data is missing from the archive");
      }
      const data: unknown = JSON.parse(exportDataText);
      expect({
        hasArchivedCommentAndDraft:
          archiveText?.includes("Comment history") === true &&
          archiveText.includes("Archived before storage failed.") &&
          archiveText.includes("Unsent comment draft") &&
          archiveText.includes("A note still being written."),
        storageWasUnavailable:
          storageWarning?.includes("Browser storage is unavailable") === true,
      }).toStrictEqual({
        hasArchivedCommentAndDraft: true,
        storageWasUnavailable: true,
      });
      expect(data).toMatchObject({
        browser: {
          annotationDraft: {
            comment: "A note still being written.",
          },
          annotations: {
            annotations: [],
            history: [
              {
                action: "copy",
                annotations: [{ comment: "Archived before storage failed." }],
              },
            ],
          },
        },
        version: 1,
      });
      await archivePage.close();
    } finally {
      await offlineContext?.close();
      await page.close();
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  it("keeps the export button inside a narrow mobile viewport", async () => {
    const { page } = await openWorkspace(browser, html, script, 320);
    try {
      const bounds = await page
        .getByRole("button", EXPORT_BUTTON)
        .evaluate((button) => {
          const rect = button.getBoundingClientRect();
          return {
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            top: rect.top,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
          };
        });
      expect(
        bounds.left >= 0 &&
          bounds.top >= 0 &&
          bounds.right <= bounds.viewportWidth &&
          bounds.bottom <= bounds.viewportHeight
      ).toBeTruthy();
    } finally {
      await page.close();
    }
  });
});

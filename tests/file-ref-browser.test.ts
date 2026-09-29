import { mkdtemp, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { render } from "../src/render.js";
import { serveSource } from "../src/serve.js";

const SOURCE = `# File preview browser test

<FileRef path="sample.ts" lines="2" />

<FileRef path="pixel.png" />

<FileRef path="guide.md" />
`;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+c8L8AAAAASUVORK5CYII=",
  "base64"
);
const SAMPLE_SOURCE =
  'export const first = 1;\nexport const second: string = "highlight me";\nexport const third = 3;\n';

const portOf = (server: Server): number => {
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("server is not listening");
  }
  return address.port;
};

const disableLiveReload = async (page: Page): Promise<void> => {
  await page.route("**/__mdxr_events", async (route) => {
    await route.fulfill({
      body: "retry: 60000\n\n",
      contentType: "text/event-stream",
      status: 200,
    });
  });
};

describe("FileRef browser preview", () => {
  let browser: Browser;
  let dir: string;
  let server: Server;
  let url: string;

  beforeAll(async () => {
    browser = await chromium.launch();
    dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-file-ref-browser-"));
    await Promise.all([
      writeFile(path.join(dir, "sample.ts"), SAMPLE_SOURCE),
      writeFile(path.join(dir, "pixel.png"), PNG),
      writeFile(
        path.join(dir, "guide.md"),
        "# Preview guide\n\n:::note\nAn MDXR callout in the preview.\n:::\n"
      ),
    ]);
    server = await serveSource(SOURCE, 0, { dir });
    url = `http://127.0.0.1:${portOf(server)}/`;
  }, 30_000);

  afterAll(async () => {
    await browser?.close();
    server?.closeAllConnections();
    server?.close();
    if (dir !== undefined) {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("highlights the requested source lines and restores focus when closed", async () => {
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    try {
      await disableLiveReload(page);
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: (value: string) => {
              document.documentElement.dataset.copied = value;
            },
          },
        });
      });
      await page.goto(url);
      const trigger = page
        .locator("[data-mdxr-file-preview]")
        .filter({ hasText: "sample.ts" });
      await expect(trigger.getAttribute("href")).resolves.toMatch(
        /^vscode:\/\/file\/.+sample\.ts:2$/u
      );

      await trigger.click();
      const dialog = page.getByRole("dialog");
      const source = dialog.locator('[aria-label="Source code"]');
      await source.waitFor();
      const sourceState = await source.evaluate((element) => ({
        hasSyntaxHighlight:
          element.querySelector(".mdxr-workspace-syntax") !== null,
        highlightedLines: Array.from(
          element.querySelectorAll<HTMLElement>("[data-line].highlighted"),
          (line) => line.dataset.line
        ),
      }));
      expect(sourceState).toStrictEqual({
        hasSyntaxHighlight: true,
        highlightedLines: ["2"],
      });

      const pathCopy = dialog.locator('button[title="Copy path"]');
      await pathCopy.click();
      await page.waitForFunction(() => {
        const button = document.querySelector(
          '[role="dialog"] button[title="Copy path"]'
        );
        return (
          button?.classList.contains("copied") === true &&
          document.documentElement.dataset.copied === "sample.ts"
        );
      });
      const pathCopyState = await pathCopy.evaluate((element) => ({
        copied: element.classList.contains("copied"),
        label: element.getAttribute("aria-label"),
        payload: document.documentElement.dataset.copied,
      }));
      const pathDialogIsOpen = await dialog.isVisible();
      expect({
        ...pathCopyState,
        dialogIsOpen: pathDialogIsOpen,
      }).toStrictEqual({
        copied: true,
        dialogIsOpen: true,
        label: "Copied",
        payload: "sample.ts",
      });

      const contentsCopy = dialog.locator('button[title="Copy contents"]');
      await contentsCopy.click();
      await page.waitForFunction((contents) => {
        const button = document.querySelector(
          '[role="dialog"] button[title="Copy contents"]'
        );
        return (
          button?.classList.contains("copied") === true &&
          document.documentElement.dataset.copied === contents
        );
      }, SAMPLE_SOURCE);
      const contentsCopyState = await contentsCopy.evaluate((element) => ({
        copied: element.classList.contains("copied"),
        label: element.getAttribute("aria-label"),
        payload: document.documentElement.dataset.copied,
      }));
      const contentsDialogIsOpen = await dialog.isVisible();
      expect({
        ...contentsCopyState,
        dialogIsOpen: contentsDialogIsOpen,
      }).toStrictEqual({
        copied: true,
        dialogIsOpen: true,
        label: "Copied",
        payload: SAMPLE_SOURCE,
      });

      await dialog.getByRole("button", { name: "Close" }).click();
      await dialog.waitFor({ state: "hidden" });
      await expect
        .poll(
          async () =>
            await trigger.evaluate(
              (element) => document.activeElement === element
            )
        )
        .toBeTruthy();
      await page.keyboard.press("Enter");
      await dialog.waitFor();
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
    } finally {
      await page.close();
    }
  });

  it("shows native image dimensions and switches Markdown preview tabs by keyboard", async () => {
    const page = await browser.newPage();
    try {
      await disableLiveReload(page);
      await page.goto(url);
      const imageTrigger = page
        .locator("[data-mdxr-file-preview]")
        .filter({ hasText: "pixel.png" });
      await imageTrigger.click();
      const dialog = page.getByRole("dialog");
      const image = dialog.getByRole("img", { name: "pixel.png" });
      await image.waitFor();
      await page.waitForFunction(() => {
        const preview = document.querySelector<HTMLImageElement>(
          '[role="dialog"] img[alt="pixel.png"]'
        );
        return preview?.complete === true && preview.naturalWidth > 0;
      });
      await expect(
        image.evaluate((element: HTMLImageElement) => ({
          height: element.naturalHeight,
          width: element.naturalWidth,
        }))
      ).resolves.toStrictEqual({ height: 1, width: 1 });

      await dialog.getByRole("button", { name: "Close" }).click();
      await dialog.waitFor({ state: "hidden" });
      await page
        .locator("[data-mdxr-file-preview]")
        .filter({ hasText: "guide.md" })
        .click();
      const rendered = dialog.frameLocator('iframe[title="Rendered guide.md"]');
      await rendered.locator("aside").waitFor();
      const calloutText = await rendered.locator("aside").textContent();
      expect(calloutText).toContain("An MDXR callout in the preview.");

      const renderedTab = dialog.getByRole("tab", { name: "Rendered" });
      await renderedTab.focus();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () =>
          document
            .querySelector('[role="dialog"] [role="tab"][aria-selected="true"]')
            ?.textContent?.trim() === "Raw"
      );
      const rawState = await dialog.evaluate((element) => {
        const source = element.querySelector('[aria-label="Source code"]');
        return {
          hasSyntaxHighlight:
            source?.querySelector(".mdxr-workspace-syntax") !== null,
          includesRawDirective:
            source?.textContent?.includes(":::note") ?? false,
          selectedTab: element.querySelector(
            '[role="tab"][aria-selected="true"]'
          )?.textContent,
        };
      });
      expect(rawState).toStrictEqual({
        hasSyntaxHighlight: true,
        includesRawDirective: true,
        selectedTab: "Raw",
      });
    } finally {
      await page.close();
    }
  });

  it("keeps the editor link in static HTML opened with file://", async () => {
    const page = await browser.newPage();
    const previewRequests: string[] = [];
    try {
      page.on("request", (request) => {
        if (request.url().includes("/__mdxr_file")) {
          previewRequests.push(request.url());
        }
      });
      await page.addInitScript(() => {
        document.addEventListener("click", (event) => {
          const { target } = event;
          if (!(target instanceof Element)) {
            return;
          }
          const link = target.closest('a[href^="vscode://file/"]');
          if (link !== null) {
            document.documentElement.dataset.fileRefDefaultPrevented = String(
              event.defaultPrevented
            );
            event.preventDefault();
          }
        });
      });
      const htmlPath = path.join(dir, "static.html");
      await writeFile(
        htmlPath,
        await render('<FileRef path="sample.ts" />', {
          dir,
          filePath: path.join(dir, "document.mdx"),
        })
      );
      await page.goto(pathToFileURL(htmlPath).href);
      const link = page.locator('a[href^="vscode://file/"]');
      const href = await link.getAttribute("href");
      await link.click();
      await page.waitForFunction(
        () =>
          document.documentElement.dataset.fileRefDefaultPrevented !== undefined
      );
      const state = await page.evaluate(() => ({
        defaultPrevented:
          document.documentElement.dataset.fileRefDefaultPrevented,
        hasPreviewUrl:
          document.querySelector("[data-mdxr-file-preview]") !== null,
        modalOpen: document.querySelector('[role="dialog"]') !== null,
      }));
      expect({
        ...state,
        hrefIsEditorUrl: href?.startsWith("vscode://file/") ?? false,
        previewRequests: previewRequests.length,
      }).toStrictEqual({
        defaultPrevented: "false",
        hasPreviewUrl: false,
        hrefIsEditorUrl: true,
        modalOpen: false,
        previewRequests: 0,
      });
    } finally {
      await page.close();
    }
  });
});

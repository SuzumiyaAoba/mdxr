import path from "node:path";

import { build } from "esbuild";
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

declare global {
  interface Window {
    docWorkspaceSnapshot?: {
      captureWorkspaceDocument: () => Promise<string>;
    };
  }
}

const ORIGIN = "http://snapshot.test";
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><view id="icon" viewBox="0 0 10 10"/><g id="pattern"><rect width="10" height="10" fill="#0f766e"/></g></svg>`;
const NESTED_DOCUMENT = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/frame.css"><style>.inline-icon{background-image:url('/frame.svg#pattern')}</style></head><body><p>Nested iframe body is visible.</p><img id="nested-icon" alt="Nested SVG icon" src="/sprite.svg#icon"><div class="inline-icon">Inline style</div><script>window.__snapshotScriptRan=true</script></body></html>`;

const FIXTURE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><main id="doc-root"><h1>Snapshot fixture</h1><img id="main-icon" alt="Main SVG icon" src="/sprite.svg#icon"><iframe title="Nested snapshot" sandbox="allow-scripts"></iframe><textarea id="draft"></textarea><input id="upload" type="file" value=""></main></body></html>`;

const openSnapshotPage = async (
  browser: Browser,
  bundle: string,
  withCssImport = false
): Promise<Page> => {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  await page.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/sprite.svg" || pathname === "/frame.svg") {
      await route.fulfill({
        body: SVG,
        contentType: "image/svg+xml",
      });
      return;
    }
    if (pathname === "/frame.css") {
      await route.fulfill({
        body: "body { background-image: url('/frame.svg#pattern'); }",
        contentType: "text/css",
      });
      return;
    }
    await route.fulfill({
      body: withCssImport
        ? FIXTURE_HTML.replace(
            '<head><meta charset="utf-8">',
            '<head><meta charset="utf-8"><style>@import url("/frame.css");</style>'
          )
        : FIXTURE_HTML,
      contentType: "text/html",
    });
  });
  await page.goto(`${ORIGIN}/fixture`);
  if (!withCssImport) {
    await page
      .locator('iframe[title="Nested snapshot"]')
      .evaluate((frame, content) => {
        frame.setAttribute("srcdoc", content);
      }, NESTED_DOCUMENT);
    await page
      .frameLocator('iframe[title="Nested snapshot"]')
      .getByText("Nested iframe body is visible.")
      .waitFor({ state: "visible" });
  }
  await page.addScriptTag({ content: bundle });
  return page;
};

const captureSnapshot = async (page: Page): Promise<string> => {
  const snapshotHtml = await page.evaluate(async () => {
    const snapshot = window.docWorkspaceSnapshot;
    if (snapshot === undefined) {
      throw new Error("Snapshot bundle is unavailable");
    }
    return await snapshot.captureWorkspaceDocument();
  });
  return snapshotHtml;
};

describe("workspace document snapshot browser behavior", () => {
  let browser: Browser;
  let bundle: string;

  beforeAll(async () => {
    browser = await chromium.launch();
    const buildResult = await build({
      bundle: true,
      entryPoints: [
        path.join(process.cwd(), "src/client/workspace-snapshot.ts"),
      ],
      format: "iife",
      globalName: "docWorkspaceSnapshot",
      platform: "browser",
      target: "es2022",
      write: false,
    });
    const [output] = buildResult.outputFiles;
    if (output === undefined) {
      throw new Error("Snapshot browser bundle was not generated");
    }
    bundle = output.text;
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it("embeds SVG fragments and srcdoc assets, keeps the nested frame visible, and omits file input values", async () => {
    const page = await openSnapshotPage(browser, bundle);
    let archivePage: Page | undefined;
    try {
      await page.locator("#draft").evaluate((element) => {
        if (!(element instanceof HTMLTextAreaElement)) {
          throw new Error("Textarea is unavailable");
        }
        element.value = "\nfirst line\nsecond line";
      });
      const snapshotHtml = await captureSnapshot(page);
      archivePage = await browser.newPage();
      const blockedRequests: string[] = [];
      await archivePage.route(/^https?:\/\//u, async (route) => {
        blockedRequests.push(route.request().url());
        await route.abort();
      });
      await archivePage.setContent(snapshotHtml, { waitUntil: "load" });

      const mainState = await archivePage.evaluate(() => {
        const image = document.querySelector<HTMLImageElement>("#main-icon");
        const frame = document.querySelector<HTMLIFrameElement>(
          'iframe[title="Nested snapshot"]'
        );
        const draft = document.querySelector<HTMLTextAreaElement>("#draft");
        const fileInput = document.querySelector<HTMLInputElement>("#upload");
        return {
          draftValue: draft?.value,
          fileValue: fileInput?.value,
          hasFileValueAttribute: fileInput?.hasAttribute("value"),
          iframeSandbox: frame?.getAttribute("sandbox"),
          mainImageSrc: image?.getAttribute("src"),
          nestedSrcdoc: frame?.getAttribute("srcdoc"),
        };
      });
      const nestedFrame = archivePage.frameLocator(
        'iframe[title="Nested snapshot"]'
      );
      await nestedFrame
        .getByText("Nested iframe body is visible.")
        .waitFor({ state: "visible" });
      const nestedState = await nestedFrame.locator("body").evaluate((body) => {
        const image = body.querySelector<HTMLImageElement>("#nested-icon");
        return {
          backgroundImage: getComputedStyle(body).backgroundImage,
          imageSrc: image?.getAttribute("src"),
          linkCount: body.ownerDocument.querySelectorAll(
            'link[rel="stylesheet"]'
          ).length,
          scriptCount: body.ownerDocument.querySelectorAll("script").length,
          text: body.textContent,
        };
      });

      expect({
        fileInputHasNoValue:
          mainState.fileValue === "" &&
          mainState.hasFileValueAttribute === false,
        hasNoExternalAssetReferences:
          !(mainState.nestedSrcdoc ?? "").includes("/sprite.svg") &&
          !(mainState.nestedSrcdoc ?? "").includes("/frame.css") &&
          !(mainState.nestedSrcdoc ?? "").includes("/frame.svg"),
        iframeIsSandboxed: mainState.iframeSandbox === "",
        mainImageKeepsFragment:
          mainState.mainImageSrc?.startsWith("data:image/svg+xml;base64,") ===
            true && mainState.mainImageSrc.endsWith("#icon"),
        nestedFrameRendered: nestedState.text?.includes(
          "Nested iframe body is visible."
        ),
        nestedImageKeepsFragment:
          nestedState.imageSrc?.startsWith("data:image/svg+xml;base64,") ===
            true && nestedState.imageSrc.endsWith("#icon"),
        nestedResourcesAreEmbedded:
          nestedState.linkCount === 0 &&
          nestedState.scriptCount === 0 &&
          nestedState.backgroundImage.includes("data:image/svg+xml;base64,") &&
          nestedState.backgroundImage.includes("#pattern"),
        noExternalRequests: blockedRequests.length === 0,
        textareaKeepsLeadingNewline:
          mainState.draftValue === "\nfirst line\nsecond line",
      }).toStrictEqual({
        fileInputHasNoValue: true,
        hasNoExternalAssetReferences: true,
        iframeIsSandboxed: true,
        mainImageKeepsFragment: true,
        nestedFrameRendered: true,
        nestedImageKeepsFragment: true,
        nestedResourcesAreEmbedded: true,
        noExternalRequests: true,
        textareaKeepsLeadingNewline: true,
      });
    } finally {
      await archivePage?.close();
      await page.close();
    }
  });

  it("reports an explicit error for stylesheets with CSS imports", async () => {
    const page = await openSnapshotPage(browser, bundle, true);
    try {
      const errorMessage = await page.evaluate(async () => {
        const snapshot = window.docWorkspaceSnapshot;
        if (snapshot === undefined) {
          throw new Error("Snapshot bundle is unavailable");
        }
        try {
          await snapshot.captureWorkspaceDocument();
          return "No error";
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      });
      expect(errorMessage).toMatch(/@import/iu);
    } finally {
      await page.close();
    }
  });
});

import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { injectAgentPreview } from "../src/agent-preview.js";
import { highlightMdxSource } from "../src/rehype/shiki.js";
import { render } from "../src/render.js";
import { workspaceJs } from "../src/workspace-js.js";

const FILE_PATH = "/project/workspace.mdx";
const BEFORE_SOURCE = `${[
  "# Workspace review",
  "",
  "## First section",
  "",
  "A fast brown fox jumps beside a quiet dog.",
  "",
  '<Callout kind="note">Review details changed.</Callout>',
  "",
  "```ts",
  'const reviewState = "before";',
  "```",
  "",
  "## Second section",
  "",
  "This section stays available in the page list.",
].join("\n")}\n`;
const AFTER_SOURCE = `${[
  "# Workspace review",
  "",
  "## First section",
  "",
  "A fast amber fox leaps beside a sleepy dog.",
  "",
  '<Callout kind="note">Current details are ready.</Callout>',
  "",
  "```ts",
  'const reviewState = "after";',
  "```",
  "",
  "## Second section",
  "",
  "This section stays available in the page list.",
].join("\n")}\n`;
const DIFF_LINES = [
  { text: "# Workspace review", type: "context" },
  { text: "", type: "context" },
  { text: "## First section", type: "context" },
  { text: "", type: "context" },
  {
    text: "A fast brown fox jumps beside a quiet dog.",
    type: "remove",
  },
  {
    text: "A fast amber fox leaps beside a sleepy dog.",
    type: "add",
  },
  { text: "", type: "context" },
  {
    text: '<Callout kind="note">Review details changed.</Callout>',
    type: "remove",
  },
  {
    text: '<Callout kind="note">Current details are ready.</Callout>',
    type: "add",
  },
  { text: "", type: "context" },
  { text: "```ts", type: "context" },
  { text: 'const reviewState = "before";', type: "remove" },
  { text: 'const reviewState = "after";', type: "add" },
  { text: "```", type: "context" },
  { text: "", type: "context" },
  { text: "## Second section", type: "context" },
  { text: "", type: "context" },
  { text: "This section stays available in the page list.", type: "context" },
] as const;

type SyntaxLines = Awaited<ReturnType<typeof highlightMdxSource>>;
let beforeSyntax: SyntaxLines;
let afterSyntax: SyntaxLines;

const VERSIONS = [
  {
    contentHash: "a".repeat(64),
    createdAt: "2026-09-27T08:00:00.000Z",
    id: "v1",
    kind: "initial",
    size: BEFORE_SOURCE.length,
  },
  {
    contentHash: "b".repeat(64),
    createdAt: "2026-09-27T08:05:00.000Z",
    id: "v2",
    kind: "change",
    size: AFTER_SOURCE.length,
  },
] as const;

const TOOL_SELECTORS = [
  ".mdxr-view-controls",
  ".mdxr-workspace-tabs",
  ".mdxr-theme",
  ".mdxr-annotation-toggle",
] as const;

const responseJson = (body: unknown): string => JSON.stringify(body);

const openWorkspacePage = async (
  browser: Browser,
  content: string,
  workspaceScript: string,
  width = 1280
): Promise<Page> => {
  const page = await browser.newPage({ viewport: { height: 900, width } });
  await page.route("http://mdxr.test/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/__mdxr_workspace.js") {
      await route.fulfill({
        body: workspaceScript,
        contentType: "text/javascript",
      });
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
      let message = "";
      if (request.method() === "POST") {
        const body: unknown = request.postDataJSON();
        if (
          typeof body === "object" &&
          body !== null &&
          "message" in body &&
          typeof body.message === "string"
        ) {
          const { message: postMessage } = body;
          message = postMessage;
        }
      }
      const messages =
        request.method() === "POST"
          ? [
              { content: message, role: "user" },
              { content: "I updated the document.", role: "assistant" },
            ]
          : [];
      await route.fulfill({
        body: responseJson({
          busy: false,
          messages,
          provider: "codex",
          sessionId: "workspace-session",
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
            syntax: id === "v1" ? beforeSyntax : afterSyntax,
          }),
          contentType: "application/json",
        });
        return;
      }
      if (view === "diff") {
        await route.fulfill({
          body: responseJson({
            from: url.searchParams.get("from"),
            lines:
              url.searchParams.get("from") === url.searchParams.get("to")
                ? []
                : DIFF_LINES,
            syntax: { after: afterSyntax, before: beforeSyntax },
            to: url.searchParams.get("to"),
          }),
          contentType: "application/json",
        });
        return;
      }
      if (view === "preview") {
        await route.fulfill({
          body: "<!doctype html><html><body><main>Historical version</main></body></html>",
          contentType: "text/html",
        });
        return;
      }
      await route.fulfill({
        body: responseJson({ latestId: "v2", versions: VERSIONS }),
        contentType: "application/json",
      });
      return;
    }
    await route.fulfill({ body: content, contentType: "text/html" });
  });
  await page.goto("http://mdxr.test/review");
  await page.locator(".mdxr-workspace-tabs").waitFor({ state: "visible" });
  await page.locator(".mdxr-view-controls").waitFor({ state: "visible" });
  return page;
};

const readToolRects = async (page: Page) =>
  await page.evaluate(
    (selectors) =>
      selectors.map((selector) => {
        const element = document.querySelector<HTMLElement>(selector);
        const rect = element?.getBoundingClientRect();
        if (rect === undefined) {
          throw new Error(`Missing workspace control: ${selector}`);
        }
        return {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
        };
      }),
    [...TOOL_SELECTORS]
  );

const readSourceSyntaxState = async (page: Page) =>
  await page.evaluate(() => {
    const rows = [
      ...document.querySelectorAll<HTMLElement>(".mdxr-workspace-code-row"),
    ];
    const jsxRow = rows.find((row) =>
      row.textContent?.includes(
        '<Callout kind="note">Current details are ready.</Callout>'
      )
    );
    const codeRow = rows.find((row) =>
      row.textContent?.includes('const reviewState = "after";')
    );
    const codeTokens = [
      ...(codeRow?.querySelectorAll<HTMLElement>(".mdxr-workspace-syntax") ??
        []),
    ];
    const dualThemeToken = codeTokens.find(
      (token) =>
        token.style.getPropertyValue("--shiki-light") !== "" &&
        token.style.getPropertyValue("--shiki-dark") !== "" &&
        token.style.getPropertyValue("--shiki-light") !==
          token.style.getPropertyValue("--shiki-dark")
    );
    return {
      activeColor:
        dualThemeToken === undefined
          ? null
          : getComputedStyle(dualThemeToken).color,
      codeSyntaxCount: codeTokens.length,
      hasDualThemeToken: dualThemeToken !== undefined,
      jsxSyntaxCount:
        jsxRow?.querySelectorAll(".mdxr-workspace-syntax").length ?? 0,
    };
  });

describe("agent workspace browser UI", () => {
  let browser: Browser;
  let html: string;
  let workspaceScript: string;

  beforeAll(async () => {
    browser = await chromium.launch();
    [beforeSyntax, afterSyntax] = await Promise.all([
      highlightMdxSource(BEFORE_SOURCE),
      highlightMdxSource(AFTER_SOURCE),
    ]);
    html = injectAgentPreview(
      await render(AFTER_SOURCE, { filePath: FILE_PATH }),
      "codex"
    );
    workspaceScript = await workspaceJs();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it.each([1280, 900, 701])(
    "aligns the top controls at %i px desktop width",
    async (width) => {
      const page = await openWorkspacePage(
        browser,
        html,
        workspaceScript,
        width
      );
      try {
        const rects = await readToolRects(page);
        const centers = rects.map(({ top, height }) => top + height / 2);
        const spread = Math.max(...centers) - Math.min(...centers);
        const headerBorderBottomWidth = await page
          .locator(".mdxr-workspace-controls")
          .evaluate((element) => getComputedStyle(element).borderBottomWidth);
        expect({
          aligned: spread <= 1,
          headerBorderBottomWidth,
        }).toStrictEqual({
          aligned: true,
          headerBorderBottomWidth: "0px",
        });
        if (width === 1280) {
          await page.screenshot({
            fullPage: true,
            path: ".mdxr/workspace-desktop.png",
          });
        }
      } finally {
        await page.close();
      }
    }
  );

  it.each([390, 320])(
    "keeps toolbar controls in bounds without overlap at %i px",
    async (width) => {
      const page = await openWorkspacePage(
        browser,
        html,
        workspaceScript,
        width
      );
      try {
        const rects = await readToolRects(page);
        const inBounds = rects.every(
          (rect) =>
            rect.left >= 0 &&
            rect.top >= 0 &&
            rect.right <= width &&
            rect.bottom <= 900
        );
        const overlaps = rects.some((first, index) =>
          rects
            .slice(index + 1)
            .some(
              (second) =>
                first.left < second.right &&
                second.left < first.right &&
                first.top < second.bottom &&
                second.top < first.bottom
            )
        );
        expect({ inBounds, overlaps }).toStrictEqual({
          inBounds: true,
          overlaps: false,
        });
        if (width === 390) {
          await page.screenshot({
            fullPage: true,
            path: ".mdxr/workspace-mobile-390.png",
          });
        }
      } finally {
        await page.close();
      }
    }
  );

  it("restores section pages after leaving Diff", async () => {
    const page = await openWorkspacePage(browser, html, workspaceScript);
    try {
      const sectionMode = page.getByRole("button", {
        exact: true,
        name: "Pages",
      });
      await sectionMode.waitFor({ state: "visible" });
      await sectionMode.click();
      const secondSection = page.getByRole("tab", {
        exact: true,
        name: "Second section",
      });
      await secondSection.click();

      await page.getByRole("button", { exact: true, name: "Diff" }).click();
      await page.locator(".mdxr-workspace-diff-view").waitFor({
        state: "visible",
      });
      const sidebarHiddenInDiff = await page.locator(".mdxr-pages").isHidden();

      await page.getByRole("button", { exact: true, name: "Preview" }).click();
      const restoredPages = await page.evaluate(() => ({
        selectedSection: document
          .querySelector<HTMLElement>(
            '.mdxr-pages [role="tab"][aria-selected="true"]'
          )
          ?.textContent?.trim(),
        sidebarVisible:
          document.querySelector<HTMLElement>(".mdxr-pages")?.hidden === false,
        view: document.body.dataset.mdxrView,
      }));
      expect({
        restoredPages,
        secondSectionSelected:
          await secondSection.getAttribute("aria-selected"),
        sidebarHiddenInDiff,
      }).toStrictEqual({
        restoredPages: {
          selectedSection: "Second section",
          sidebarVisible: true,
          view: "pages",
        },
        secondSectionSelected: "true",
        sidebarHiddenInDiff: true,
      });
    } finally {
      await page.close();
    }
  });

  it("keeps page navigation available and disabled without h2 headings", async () => {
    const noPagesHtml = injectAgentPreview(
      await render("# Single page\n\nA document without section headings.\n", {
        filePath: FILE_PATH,
      }),
      "codex"
    );
    const page = await openWorkspacePage(browser, noPagesHtml, workspaceScript);
    try {
      const controls = page.locator(".mdxr-view-controls");
      await controls.waitFor({ state: "visible" });
      const pagesButton = controls.getByRole("button", {
        exact: true,
        name: "Pages",
      });
      const navigationState = {
        controlsVisible: await controls.isVisible(),
        documentPressed: await controls
          .getByRole("button", { exact: true, name: "Document" })
          .getAttribute("aria-pressed"),
        pagesDisabled: await pagesButton.isDisabled(),
        pagesTitle: await pagesButton.getAttribute("title"),
      };
      expect(navigationState).toStrictEqual({
        controlsVisible: true,
        documentPressed: "true",
        pagesDisabled: true,
        pagesTitle: "Add an h2 heading to use pages",
      });
    } finally {
      await page.close();
    }
  });

  it("supports split and unified diffs with word-level highlights", async () => {
    const page = await openWorkspacePage(browser, html, workspaceScript);
    try {
      await page.getByRole("button", { exact: true, name: "Diff" }).click();
      const diff = page.locator(".mdxr-workspace-diff-view");
      await diff.waitFor({ state: "visible" });
      const initialDiff = await page.evaluate(() => {
        const table = document.querySelector<HTMLElement>(
          ".mdxr-workspace-diff-view"
        );
        return {
          addedWords: document.querySelectorAll(
            '.mdxr-workspace-diff-word[data-kind="add"]'
          ).length,
          headers: Array.from(
            document.querySelectorAll(
              '.mdxr-workspace-diff-view[data-layout="split"] thead th'
            ),
            (header) => header.textContent?.trim()
          ),
          layout: table?.dataset.layout,
          removedWords: document.querySelectorAll(
            '.mdxr-workspace-diff-word[data-kind="remove"]'
          ).length,
          wordDiff: table?.dataset.wordDiff,
        };
      });
      const hasWordMarks =
        initialDiff.addedWords + initialDiff.removedWords > 0;
      expect({
        hasWordMarks,
        headers: initialDiff.headers,
        layout: initialDiff.layout,
        wordDiff: initialDiff.wordDiff,
      }).toStrictEqual({
        hasWordMarks: true,
        headers: ["Before", "After"],
        layout: "split",
        wordDiff: "true",
      });
      await page.screenshot({
        fullPage: true,
        path: ".mdxr/workspace-diff-desktop.png",
      });

      await page.setViewportSize({ height: 900, width: 390 });
      await page.screenshot({
        fullPage: true,
        path: ".mdxr/workspace-diff-390.png",
      });
      const mobileDiff = page.locator(".mdxr-workspace-diff-view");
      await mobileDiff.evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
      });
      const mobileScroll = await page.evaluate(() => {
        const container = document.querySelector<HTMLElement>(
          ".mdxr-workspace-diff-view"
        );
        const afterHeader = container?.querySelector<HTMLElement>(
          'thead th[data-side="new"]'
        );
        if (
          container === null ||
          container === undefined ||
          afterHeader === null ||
          afterHeader === undefined
        ) {
          throw new Error("Missing side-by-side table columns");
        }
        const containerRect = container.getBoundingClientRect();
        const afterRect = afterHeader.getBoundingClientRect();
        return {
          afterColumnVisible:
            afterRect.left >= containerRect.left - 1 &&
            afterRect.right <= containerRect.right + 1,
          bodyFitsViewport:
            document.documentElement.scrollWidth <= window.innerWidth &&
            document.body.scrollWidth <= window.innerWidth,
          documentFitsViewport: document.documentElement.scrollWidth <= 390,
          tableCanScroll: container.scrollWidth > container.clientWidth,
          tableReachedEnd:
            container.scrollLeft + container.clientWidth >=
            container.scrollWidth - 1,
        };
      });
      expect(mobileScroll).toStrictEqual({
        afterColumnVisible: true,
        bodyFitsViewport: true,
        documentFitsViewport: true,
        tableCanScroll: true,
        tableReachedEnd: true,
      });

      const theme = page.locator(".mdxr-theme");
      await theme.click();
      await theme.click();
      const darkMode = await theme.getAttribute("data-mode");
      await page.screenshot({
        fullPage: true,
        path: ".mdxr/workspace-diff-390-dark.png",
      });

      await page.getByRole("button", { exact: true, name: "Unified" }).click();
      const wordDiff = page.getByRole("checkbox", { name: "Word diff" });
      await wordDiff.uncheck();
      const wordDiffOff = await page.evaluate(() => {
        const table = document.querySelector<HTMLElement>(
          ".mdxr-workspace-diff-view"
        );
        return {
          layout: table?.dataset.layout,
          marks: document.querySelectorAll(".mdxr-workspace-diff-word").length,
          wordDiff: table?.dataset.wordDiff,
        };
      });
      await wordDiff.check();
      const wordDiffOn = await page
        .locator(".mdxr-workspace-diff-word")
        .count();
      const hasWordDiffOn = wordDiffOn > 0;
      expect({ darkMode, hasWordDiffOn, wordDiffOff }).toStrictEqual({
        darkMode: "dark",
        hasWordDiffOn: true,
        wordDiffOff: { layout: "unified", marks: 0, wordDiff: "false" },
      });
    } finally {
      await page.close();
    }
  });

  it("highlights MDX source and keeps syntax with word diff marks", async () => {
    const page = await openWorkspacePage(browser, html, workspaceScript);
    try {
      await page.getByRole("button", { exact: true, name: "MDX" }).click();
      await page.locator(".mdxr-workspace-code").waitFor({ state: "visible" });
      await page
        .locator('.mdxr-workspace-code-row:has-text("const reviewState")')
        .waitFor({ state: "visible" });
      const sourceLight = await readSourceSyntaxState(page);

      const theme = page.locator(".mdxr-theme");
      await theme.click();
      await theme.click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>(".mdxr-theme")?.dataset.mode ===
          "dark"
      );
      const sourceDark = await readSourceSyntaxState(page);
      const darkMode = await theme.getAttribute("data-mode");
      await theme.click();
      await theme.click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>(".mdxr-theme")?.dataset.mode ===
          "light"
      );

      await page.getByRole("button", { exact: true, name: "Diff" }).click();
      await page
        .locator('.mdxr-workspace-diff-view[data-layout="split"]')
        .waitFor({ state: "visible" });
      const splitState = await page.evaluate(() => {
        const oldCode = [
          ...document.querySelectorAll<HTMLElement>(
            '.mdxr-workspace-diff-cell[data-side="old"][data-kind="remove"]'
          ),
        ].find((cell) =>
          cell.textContent?.includes('const reviewState = "before";')
        );
        const newCode = [
          ...document.querySelectorAll<HTMLElement>(
            '.mdxr-workspace-diff-cell[data-side="new"][data-kind="add"]'
          ),
        ].find((cell) =>
          cell.textContent?.includes('const reviewState = "after";')
        );
        return {
          afterHasSyntaxAndWordDiff: Boolean(
            newCode?.querySelector(
              ".mdxr-workspace-syntax.mdxr-workspace-diff-word"
            )
          ),
          beforeHasSyntaxAndWordDiff: Boolean(
            oldCode?.querySelector(
              ".mdxr-workspace-syntax.mdxr-workspace-diff-word"
            )
          ),
          layout: document.querySelector<HTMLElement>(
            ".mdxr-workspace-diff-view"
          )?.dataset.layout,
        };
      });

      await page.getByRole("button", { exact: true, name: "Unified" }).click();
      const unifiedState = await page.evaluate(() => {
        const oldCode = [
          ...document.querySelectorAll<HTMLElement>(
            '.mdxr-workspace-diff-text[data-kind="remove"]'
          ),
        ].find((line) =>
          line.textContent?.includes('const reviewState = "before";')
        );
        const newCode = [
          ...document.querySelectorAll<HTMLElement>(
            '.mdxr-workspace-diff-text[data-kind="add"]'
          ),
        ].find((line) =>
          line.textContent?.includes('const reviewState = "after";')
        );
        return {
          afterHasSyntaxAndWordDiff: Boolean(
            newCode?.querySelector(
              ".mdxr-workspace-syntax.mdxr-workspace-diff-word"
            )
          ),
          beforeHasSyntaxAndWordDiff: Boolean(
            oldCode?.querySelector(
              ".mdxr-workspace-syntax.mdxr-workspace-diff-word"
            )
          ),
          layout: document.querySelector<HTMLElement>(
            ".mdxr-workspace-diff-view"
          )?.dataset.layout,
        };
      });

      await page.getByRole("checkbox", { name: "Word diff" }).uncheck();
      const wordDiffOff = await page.evaluate(() => {
        const codeLine = [
          ...document.querySelectorAll<HTMLElement>(
            '.mdxr-workspace-diff-text[data-kind="add"]'
          ),
        ].find((line) =>
          line.textContent?.includes('const reviewState = "after";')
        );
        return {
          hasSyntax: Boolean(codeLine?.querySelector(".mdxr-workspace-syntax")),
          wordMarks: document.querySelectorAll(".mdxr-workspace-diff-word")
            .length,
        };
      });

      expect({
        darkMode,
        sourceHasMdxAndFenceTokens:
          sourceLight.jsxSyntaxCount > 0 && sourceLight.codeSyntaxCount > 0,
        sourceThemeChanged:
          sourceLight.hasDualThemeToken &&
          sourceDark.hasDualThemeToken &&
          sourceLight.activeColor !== sourceDark.activeColor,
        splitState,
        unifiedState,
        wordDiffOff,
      }).toStrictEqual({
        darkMode: "dark",
        sourceHasMdxAndFenceTokens: true,
        sourceThemeChanged: true,
        splitState: {
          afterHasSyntaxAndWordDiff: true,
          beforeHasSyntaxAndWordDiff: true,
          layout: "split",
        },
        unifiedState: {
          afterHasSyntaxAndWordDiff: true,
          beforeHasSyntaxAndWordDiff: true,
          layout: "unified",
        },
        wordDiffOff: { hasSyntax: true, wordMarks: 0 },
      });
    } finally {
      await page.close();
    }
  });

  it("handles an unchanged comparison, source, theme, annotations, and chat", async () => {
    const page = await openWorkspacePage(browser, html, workspaceScript);
    try {
      await page.getByRole("button", { exact: true, name: "Diff" }).click();
      const comparison = page.getByLabel("Compare with");
      await comparison.selectOption("v2");
      await page.getByText("No changes", { exact: true }).waitFor({
        state: "visible",
      });
      const emptyDiff = await page.evaluate(() => ({
        compareId: document.querySelector<HTMLSelectElement>(
          ".mdxr-workspace-compare select"
        )?.value,
        noChanges: document
          .querySelector(".mdxr-workspace-notice")
          ?.textContent?.includes("No changes"),
      }));
      expect(emptyDiff).toStrictEqual({ compareId: "v2", noChanges: true });

      await page.getByRole("button", { exact: true, name: "Preview" }).click();
      const theme = page.locator(".mdxr-theme");
      await theme.click();
      await page.locator(".mdxr-annotation-toggle").click();
      const panel = page.locator("#mdxr-annotation-panel");
      await panel.waitFor({ state: "visible" });

      await page.getByRole("button", { exact: true, name: "MDX" }).click();
      await page.locator(".mdxr-workspace-code").waitFor({ state: "visible" });
      const sourceState = await page.evaluate(() => {
        const annotations =
          document.querySelector<HTMLElement>(".mdxr-annotations");
        return {
          annotationsHidden:
            annotations !== null &&
            getComputedStyle(annotations).display === "none",
          hasSource: document
            .querySelector(".mdxr-workspace-code")
            ?.textContent?.includes("fast amber fox"),
        };
      });

      await page.getByRole("button", { exact: true, name: "Preview" }).click();
      const agentToggle = page.locator(".mdxr-workspace-agent");
      await agentToggle.click();
      await page.locator(".mdxr-workspace-chat").waitFor({ state: "visible" });
      await agentToggle.click();
      await page.locator(".mdxr-workspace-chat").waitFor({ state: "hidden" });
      const chromeState = await page.evaluate(() => ({
        agentClosed: document.querySelector(".mdxr-workspace-chat") === null,
        annotationExpanded:
          document
            .querySelector(".mdxr-annotation-toggle")
            ?.getAttribute("aria-expanded") === "true",
        themeMode:
          document.querySelector<HTMLElement>(".mdxr-theme")?.dataset.mode,
      }));
      expect({ chromeState, sourceState }).toStrictEqual({
        chromeState: {
          agentClosed: true,
          annotationExpanded: true,
          themeMode: "light",
        },
        sourceState: { annotationsHidden: true, hasSource: true },
      });
    } finally {
      await page.close();
    }
  });
});

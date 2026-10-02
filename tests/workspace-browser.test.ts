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
  ".doc-view-controls",
  ".doc-workspace-tabs",
  ".doc-theme",
  ".doc-annotation-toggle",
] as const;

const responseJson = (body: unknown): string => JSON.stringify(body);

interface AgentPostResponse {
  body: unknown;
  status?: number;
}

const openWorkspacePage = async (
  browser: Browser,
  content: string,
  workspaceScript: string,
  width = 1280,
  agentPostResponse?: (
    message: string,
    page: Page
  ) => AgentPostResponse | Promise<AgentPostResponse>
): Promise<Page> => {
  const page = await browser.newPage({ viewport: { height: 900, width } });
  await page.route("http://mdxr.test/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/__doc_workspace.js") {
      await route.fulfill({
        body: workspaceScript,
        contentType: "text/javascript",
      });
      return;
    }
    if (url.pathname === "/__doc_events") {
      await route.fulfill({
        body: "retry: 60000\nevent: agent\ndata: {}\n\n",
        headers: {
          "cache-control": "no-cache",
          "content-type": "text/event-stream",
        },
      });
      return;
    }
    if (url.pathname === "/__doc_agent") {
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
      if (request.method() === "POST" && agentPostResponse !== undefined) {
        const response = await agentPostResponse(message, page);
        await route.fulfill({
          body: responseJson(response.body),
          contentType: "application/json",
          status: response.status ?? 200,
        });
        return;
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
    if (url.pathname === "/__doc_history") {
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
        const isDark = url.searchParams.get("theme") === "dark";
        const theme = isDark ? "dark" : "light";
        await route.fulfill({
          body: `<!doctype html><html${isDark ? ' class="dark"' : ""} style="color-scheme: ${theme}"><head><style>html.dark { background-color: rgb(12, 34, 56); } html:not(.dark) { background-color: rgb(230, 240, 250); }</style></head><body><main>Historical version ${url.searchParams.get("id")}</main><script>window.__docHistoricalPreviewScriptRan = true;</script></body></html>`,
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
  await page.locator(".doc-workspace-tabs").waitFor({ state: "visible" });
  await page.locator(".doc-view-controls").waitFor({ state: "visible" });
  return page;
};

const observeChatStyleAttribute = async (
  page: Page,
  attributeName: "data-ending-style" | "data-starting-style"
): Promise<boolean> =>
  await page.evaluate(
    async (observedAttribute) =>
      // MutationObserver exposes callbacks, so bridge its result to Playwright.
      // oxlint-disable-next-line promise/avoid-new
      await new Promise<boolean>((resolve) => {
        const panelSelector = "[data-doc-agent-panel]";
        const observation: {
          observer?: MutationObserver;
          timeoutId?: number;
        } = {};
        const finish = (detected: boolean) => {
          observation.observer?.disconnect();
          window.clearTimeout(observation.timeoutId);
          resolve(detected);
        };
        const includesObservedAttribute = (node: Node): boolean => {
          if (!(node instanceof Element)) {
            return false;
          }
          return (
            node.matches(`${panelSelector}[${observedAttribute}]`) ||
            node.querySelector(`${panelSelector}[${observedAttribute}]`) !==
              null
          );
        };
        const observer = new MutationObserver((records) => {
          const found = records.some((record) => {
            if (
              record.type === "attributes" &&
              record.attributeName === observedAttribute &&
              record.target instanceof Element
            ) {
              return record.target.matches(panelSelector);
            }
            return [...record.addedNodes].some(includesObservedAttribute);
          });
          if (found) {
            finish(true);
          }
        });
        observation.observer = observer;
        observer.observe(document.documentElement, {
          attributeFilter: [observedAttribute],
          attributes: true,
          childList: true,
          subtree: true,
        });
        observation.timeoutId = window.setTimeout(() => {
          finish(false);
        }, 1000);
      }),
    attributeName
  );

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
      ...document.querySelectorAll<HTMLElement>(".doc-workspace-code-row"),
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
      ...(codeRow?.querySelectorAll<HTMLElement>(".doc-workspace-syntax") ??
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
        jsxRow?.querySelectorAll(".doc-workspace-syntax").length ?? 0,
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
          .locator(".doc-workspace-controls")
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
      await page.locator(".doc-workspace-diff-view").waitFor({
        state: "visible",
      });
      const sidebarHiddenInDiff = await page.locator(".doc-pages").isHidden();

      await page.getByRole("button", { exact: true, name: "Preview" }).click();
      const restoredPages = await page.evaluate(() => ({
        selectedSection: document
          .querySelector<HTMLElement>(
            '.doc-pages [role="tab"][aria-selected="true"]'
          )
          ?.textContent?.trim(),
        sidebarVisible:
          document.querySelector<HTMLElement>(".doc-pages")?.hidden === false,
        view: document.body.dataset.docView,
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
      const controls = page.locator(".doc-view-controls");
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
      const diff = page.locator(".doc-workspace-diff-view");
      await diff.waitFor({ state: "visible" });
      const initialDiff = await page.evaluate(() => {
        const table = document.querySelector<HTMLElement>(
          ".doc-workspace-diff-view"
        );
        return {
          addedWords: document.querySelectorAll(
            '.doc-workspace-diff-word[data-kind="add"]'
          ).length,
          headers: Array.from(
            document.querySelectorAll(
              '.doc-workspace-diff-view[data-layout="split"] thead th'
            ),
            (header) => header.textContent?.trim()
          ),
          layout: table?.dataset.layout,
          removedWords: document.querySelectorAll(
            '.doc-workspace-diff-word[data-kind="remove"]'
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
      const mobileDiff = page.locator(".doc-workspace-diff-view");
      await mobileDiff.evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
      });
      const mobileScroll = await page.evaluate(() => {
        const container = document.querySelector<HTMLElement>(
          ".doc-workspace-diff-view"
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

      const theme = page.locator(".doc-theme");
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
          ".doc-workspace-diff-view"
        );
        return {
          layout: table?.dataset.layout,
          marks: document.querySelectorAll(".doc-workspace-diff-word").length,
          wordDiff: table?.dataset.wordDiff,
        };
      });
      await wordDiff.check();
      const wordDiffOn = await page.locator(".doc-workspace-diff-word").count();
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
      await page.locator(".doc-workspace-code").waitFor({ state: "visible" });
      await page
        .locator('.doc-workspace-code-row:has-text("const reviewState")')
        .waitFor({ state: "visible" });
      const sourceLight = await readSourceSyntaxState(page);

      const theme = page.locator(".doc-theme");
      await theme.click();
      await theme.click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>(".doc-theme")?.dataset.mode ===
          "dark"
      );
      const sourceDark = await readSourceSyntaxState(page);
      const darkMode = await theme.getAttribute("data-mode");
      await theme.click();
      await theme.click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>(".doc-theme")?.dataset.mode ===
          "light"
      );

      await page.getByRole("button", { exact: true, name: "Diff" }).click();
      await page
        .locator('.doc-workspace-diff-view[data-layout="split"]')
        .waitFor({ state: "visible" });
      const splitState = await page.evaluate(() => {
        const oldCode = [
          ...document.querySelectorAll<HTMLElement>(
            '.doc-workspace-diff-cell[data-side="old"][data-kind="remove"]'
          ),
        ].find((cell) =>
          cell.textContent?.includes('const reviewState = "before";')
        );
        const newCode = [
          ...document.querySelectorAll<HTMLElement>(
            '.doc-workspace-diff-cell[data-side="new"][data-kind="add"]'
          ),
        ].find((cell) =>
          cell.textContent?.includes('const reviewState = "after";')
        );
        return {
          afterHasSyntaxAndWordDiff: Boolean(
            newCode?.querySelector(
              ".doc-workspace-syntax.doc-workspace-diff-word"
            )
          ),
          beforeHasSyntaxAndWordDiff: Boolean(
            oldCode?.querySelector(
              ".doc-workspace-syntax.doc-workspace-diff-word"
            )
          ),
          layout: document.querySelector<HTMLElement>(
            ".doc-workspace-diff-view"
          )?.dataset.layout,
        };
      });

      await page.getByRole("button", { exact: true, name: "Unified" }).click();
      const unifiedState = await page.evaluate(() => {
        const oldCode = [
          ...document.querySelectorAll<HTMLElement>(
            '.doc-workspace-diff-text[data-kind="remove"]'
          ),
        ].find((line) =>
          line.textContent?.includes('const reviewState = "before";')
        );
        const newCode = [
          ...document.querySelectorAll<HTMLElement>(
            '.doc-workspace-diff-text[data-kind="add"]'
          ),
        ].find((line) =>
          line.textContent?.includes('const reviewState = "after";')
        );
        return {
          afterHasSyntaxAndWordDiff: Boolean(
            newCode?.querySelector(
              ".doc-workspace-syntax.doc-workspace-diff-word"
            )
          ),
          beforeHasSyntaxAndWordDiff: Boolean(
            oldCode?.querySelector(
              ".doc-workspace-syntax.doc-workspace-diff-word"
            )
          ),
          layout: document.querySelector<HTMLElement>(
            ".doc-workspace-diff-view"
          )?.dataset.layout,
        };
      });

      await page.getByRole("checkbox", { name: "Word diff" }).uncheck();
      const wordDiffOff = await page.evaluate(() => {
        const codeLine = [
          ...document.querySelectorAll<HTMLElement>(
            '.doc-workspace-diff-text[data-kind="add"]'
          ),
        ].find((line) =>
          line.textContent?.includes('const reviewState = "after";')
        );
        return {
          hasSyntax: Boolean(codeLine?.querySelector(".doc-workspace-syntax")),
          wordMarks: document.querySelectorAll(".doc-workspace-diff-word")
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

  it("keeps historical previews in sync with explicit and system themes", async () => {
    const page = await openWorkspacePage(browser, html, workspaceScript);
    const previewSelector = ".doc-workspace-history-preview iframe";
    const iframe = page.locator(previewSelector);
    const readPreviewTheme = async () =>
      await page
        .frameLocator(previewSelector)
        .locator("html")
        .evaluate((element) => ({
          backgroundColor: getComputedStyle(element).backgroundColor,
          colorScheme: getComputedStyle(element).colorScheme,
          isDark: element.classList.contains("dark"),
          scriptRan: Reflect.has(window, "__docHistoricalPreviewScriptRan"),
          version: element.querySelector("main")?.textContent,
        }));
    const expectPreviewTheme = async (
      theme: "dark" | "light",
      version: string
    ) => {
      await expect
        .poll(
          async () =>
            await iframe.evaluate((element) =>
              element instanceof HTMLIFrameElement
                ? new URL(element.src).searchParams.get("theme")
                : null
            )
        )
        .toBe(theme);
      await expect.poll(readPreviewTheme).toStrictEqual({
        backgroundColor:
          theme === "dark" ? "rgb(12, 34, 56)" : "rgb(230, 240, 250)",
        colorScheme: theme,
        isDark: theme === "dark",
        scriptRan: false,
        version: `Historical version ${version}`,
      });
    };

    try {
      await page.emulateMedia({ colorScheme: "dark" });
      await expect
        .poll(
          async () =>
            await page.evaluate(() =>
              document.documentElement.classList.contains("dark")
            )
        )
        .toBe(true);

      await page.getByRole("button", { exact: true, name: "MDX" }).click();
      const versionSelect = page.getByRole("combobox", {
        name: "Document version",
      });
      await page.locator('#doc-version-select option[value="v1"]').waitFor({
        state: "attached",
      });
      await versionSelect.selectOption("v1");
      await page.getByRole("button", { exact: true, name: "Preview" }).click();
      await expectPreviewTheme("dark", "v1");
      await expect
        .poll(async () => await iframe.getAttribute("sandbox"))
        .toBe("");

      const themeButton = page.locator(".doc-theme");
      await themeButton.click();
      await expect
        .poll(async () => await themeButton.getAttribute("data-mode"))
        .toBe("light");
      await expectPreviewTheme("light", "v1");

      await themeButton.click();
      await expect
        .poll(async () => await themeButton.getAttribute("data-mode"))
        .toBe("dark");
      await themeButton.click();
      await expect
        .poll(async () => await themeButton.getAttribute("data-mode"))
        .toBe("auto");

      await page.emulateMedia({ colorScheme: "light" });
      await expect
        .poll(
          async () =>
            await page.evaluate(() =>
              document.documentElement.classList.contains("dark")
            )
        )
        .toBe(false);
      await expectPreviewTheme("light", "v1");

      await page.emulateMedia({ colorScheme: "dark" });
      await expect
        .poll(
          async () =>
            await page.evaluate(() =>
              document.documentElement.classList.contains("dark")
            )
        )
        .toBe(true);
      await expectPreviewTheme("dark", "v1");

      await versionSelect.selectOption("v2");
      await expectPreviewTheme("dark", "v2");
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
          ".doc-workspace-compare select"
        )?.value,
        noChanges: document
          .querySelector(".doc-workspace-notice")
          ?.textContent?.includes("No changes"),
      }));
      expect(emptyDiff).toStrictEqual({ compareId: "v2", noChanges: true });

      await page.getByRole("button", { exact: true, name: "Preview" }).click();
      const theme = page.locator(".doc-theme");
      await theme.click();
      await page.locator(".doc-annotation-toggle").click();
      const panel = page.locator("#doc-annotation-panel");
      await panel.waitFor({ state: "visible" });

      await page.getByRole("button", { exact: true, name: "MDX" }).click();
      await page.locator(".doc-workspace-code").waitFor({ state: "visible" });
      const sourceState = await page.evaluate(() => {
        const annotations =
          document.querySelector<HTMLElement>(".doc-annotations");
        return {
          annotationsHidden:
            annotations !== null &&
            getComputedStyle(annotations).display === "none",
          hasSource: document
            .querySelector(".doc-workspace-code")
            ?.textContent?.includes("fast amber fox"),
        };
      });

      await page.getByRole("button", { exact: true, name: "Preview" }).click();
      const agentToggle = page.locator(".doc-workspace-agent");
      await agentToggle.click();
      await page.locator(".doc-workspace-chat").waitFor({ state: "visible" });
      await agentToggle.click();
      await page.locator(".doc-workspace-chat").waitFor({ state: "hidden" });
      const chromeState = await page.evaluate(() => ({
        agentClosed: document.querySelector(".doc-workspace-chat") === null,
        annotationExpanded:
          document
            .querySelector(".doc-annotation-toggle")
            ?.getAttribute("aria-expanded") === "true",
        themeMode:
          document.querySelector<HTMLElement>(".doc-theme")?.dataset.mode,
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

  it("animates chat transitions, settles rapid toggles, and restores focus", async () => {
    const page = await openWorkspacePage(browser, html, workspaceScript);
    const agentToggle = page.locator(".doc-workspace-agent");
    const chat = page.locator(".doc-workspace-chat");
    try {
      const openingStyleObserved = observeChatStyleAttribute(
        page,
        "data-starting-style"
      );
      await agentToggle.click();
      await expect(openingStyleObserved).resolves.toBeTruthy();

      const openingTransition = await chat.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          duration: style.transitionDuration,
          property: style.transitionProperty,
        };
      });
      expect(openingTransition.property).toContain("opacity");
      expect(
        openingTransition.duration
          .split(",")
          .some(
            (duration) => duration.trim() !== "0s" && duration.trim() !== "0ms"
          )
      ).toBeTruthy();

      await page.getByRole("button", { exact: true, name: "MDX" }).click();
      await expect
        .poll(
          async () =>
            await page
              .getByRole("button", { exact: true, name: "MDX" })
              .getAttribute("aria-pressed")
        )
        .toBe("true");
      await page.getByRole("button", { exact: true, name: "Preview" }).click();
      await expect
        .poll(
          async () =>
            await page
              .getByRole("button", { exact: true, name: "Preview" })
              .getAttribute("aria-pressed")
        )
        .toBe("true");
      await expect(agentToggle.getAttribute("aria-expanded")).resolves.toBe(
        "true"
      );

      const endingStyleObserved = observeChatStyleAttribute(
        page,
        "data-ending-style"
      );
      await page.getByRole("button", { name: "Close chat" }).click();
      await expect(endingStyleObserved).resolves.toBeTruthy();
      await expect
        .poll(
          async () =>
            await page.evaluate(
              () =>
                document.activeElement?.classList.contains(
                  "doc-workspace-agent"
                ) ?? false
            )
        )
        .toBe(true);
      await expect.poll(async () => await chat.count()).toBe(0);

      await page.evaluate(() => {
        const toggle = document.querySelector<HTMLButtonElement>(
          ".doc-workspace-agent"
        );
        if (toggle === null) {
          throw new Error("Missing agent chat toggle");
        }
        for (let index = 0; index < 4; index += 1) {
          toggle.click();
        }
      });
      await expect
        .poll(async () => await agentToggle.getAttribute("aria-expanded"))
        .toBe("false");
      await expect.poll(async () => await chat.count()).toBe(0);
    } finally {
      await page.close();
    }
  });

  it("removes chat transitions and closes promptly with reduced motion", async () => {
    const page = await openWorkspacePage(browser, html, workspaceScript);
    const agentToggle = page.locator(".doc-workspace-agent");
    const chat = page.locator(".doc-workspace-chat");
    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(
        page.evaluate(
          () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
        )
      ).resolves.toBeTruthy();

      await agentToggle.click();
      await expect
        .poll(async () => await agentToggle.getAttribute("aria-expanded"))
        .toBe("true");
      const transition = await chat.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          duration: style.transitionDuration,
          property: style.transitionProperty,
        };
      });
      expect(transition).toStrictEqual({
        duration: "0s",
        property: "none",
      });

      await page.getByRole("button", { name: "Close chat" }).click();
      await expect
        .poll(async () => await agentToggle.getAttribute("aria-expanded"))
        .toBe("false");
      await expect.poll(async () => await chat.count()).toBe(0);
      await expect(
        page.evaluate(
          () =>
            document.activeElement?.classList.contains("doc-workspace-agent") ??
            false
        )
      ).resolves.toBeTruthy();
    } finally {
      await page.close();
    }
  });

  it("sends multiline chat messages and contains long responses on desktop and mobile", async () => {
    const firstParagraph =
      "Please update the guide with a clear explanation. ".repeat(6);
    const secondParagraph = "Keep the existing headings and examples intact.";
    const submittedMessage = `${firstParagraph}\n${secondParagraph}`;
    const assistantHtml = [
      "<h2>Suggested update</h2>",
      "<p>Here is a longer response with the complete set of notes.</p>",
      "<pre><code>export const reviewReady = true;</code></pre>",
      `<ul>${Array.from(
        { length: 14 },
        (_, index) => `<li>Review detail ${index + 1}</li>`
      ).join("")}</ul>`,
      "<table><thead><tr><th>Section</th><th>Change</th></tr></thead><tbody><tr><td>Overview</td><td>Clarified</td></tr><tr><td>Examples</td><td>Preserved</td></tr></tbody></table>",
    ].join("");
    let sentMessage = "";
    const page = await openWorkspacePage(
      browser,
      html,
      workspaceScript,
      1280,
      async (message, postPage) => {
        sentMessage = message;
        await postPage.waitForTimeout(1200);
        return {
          body: {
            busy: false,
            messages: [
              {
                content: message,
                html: `<p><strong>Request</strong></p><p>${message.replaceAll("\n", "<br>")}</p><p><em>Keep the existing headings.</em></p>`,
                role: "user",
              },
              {
                content: "The guide is ready.",
                html: assistantHtml,
                role: "assistant",
              },
            ],
            provider: "codex",
            sessionId: "workspace-session",
          },
        };
      }
    );
    try {
      const theme = page.locator(".doc-theme");
      await theme.click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>(".doc-theme")?.dataset.mode ===
          "light"
      );
      const agentToggle = page.locator(".doc-workspace-agent");
      await agentToggle.click();
      const chat = page.locator(".doc-workspace-chat");
      await chat.waitFor({ state: "visible" });
      const composer = page.getByRole("textbox", { name: "Message to agent" });
      const sendButton = page.getByRole("button", { name: "Send message" });
      const emptyState = {
        inputDisabled: await composer.isDisabled(),
        sendDisabled: await sendButton.isDisabled(),
      };
      await composer.fill(firstParagraph);
      await composer.press("Shift+Enter");
      await composer.pressSequentially(secondParagraph);
      const readyState = {
        inputEnabled: !(await composer.isDisabled()),
        inputValue: await composer.inputValue(),
        sendEnabled: await sendButton.isEnabled(),
      };
      const postRequest = page.waitForRequest(
        (request) =>
          request.url().includes("/__doc_agent") && request.method() === "POST"
      );
      await sendButton.click();
      await postRequest;
      await page.waitForFunction(() => {
        const textarea = document.querySelector<HTMLTextAreaElement>(
          '[aria-label="Message to agent"]'
        );
        const button = document.querySelector<HTMLButtonElement>(
          '[aria-label="Send message"]'
        );
        return textarea?.disabled === true && button?.disabled === true;
      });
      const busyState = {
        inputDisabled: await composer.isDisabled(),
        sendDisabled: await sendButton.isDisabled(),
      };
      await page
        .locator('.doc-workspace-message[data-role="assistant"] table')
        .waitFor({ state: "visible" });
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLTextAreaElement>(
            '[aria-label="Message to agent"]'
          )?.value === ""
      );
      const renderedResponse = await page.evaluate(() => {
        const userMessage = document.querySelector<HTMLElement>(
          '.doc-workspace-message[data-role="user"]'
        );
        const assistantMessage = document.querySelector<HTMLElement>(
          '.doc-workspace-message[data-role="assistant"]'
        );
        const body = document.querySelector<HTMLElement>(
          ".doc-workspace-chat-body"
        );
        return {
          assistantCode: Boolean(assistantMessage?.querySelector("pre code")),
          assistantListItems:
            assistantMessage?.querySelectorAll("ul li").length ?? 0,
          assistantTableHeaders:
            assistantMessage?.querySelectorAll("thead th").length ?? 0,
          bodyCanScroll:
            body !== null &&
            body !== undefined &&
            body.scrollHeight > body.clientHeight,
          userMarkdown: Boolean(
            userMessage?.querySelector("strong") &&
            userMessage.querySelector("em") &&
            userMessage.textContent?.includes("Keep the existing headings.")
          ),
        };
      });
      const desktopLayout = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>(
          ".doc-workspace-chat"
        );
        if (panel === null) {
          throw new Error("Missing agent chat panel");
        }
        const rect = panel.getBoundingClientRect();
        return {
          inBounds:
            rect.left >= 0 &&
            rect.top >= 0 &&
            rect.right <= window.innerWidth &&
            rect.bottom <= window.innerHeight,
          pageFits: document.documentElement.scrollWidth <= window.innerWidth,
          width: window.innerWidth,
        };
      });
      await theme.click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>(".doc-theme")?.dataset.mode ===
          "dark"
      );
      await page.setViewportSize({ height: 844, width: 390 });
      const mobileLayout = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>(
          ".doc-workspace-chat"
        );
        if (panel === null) {
          throw new Error("Missing agent chat panel");
        }
        const rect = panel.getBoundingClientRect();
        return {
          inBounds:
            rect.left >= 0 &&
            rect.top >= 0 &&
            rect.right <= window.innerWidth &&
            rect.bottom <= window.innerHeight,
          pageFits: document.documentElement.scrollWidth <= window.innerWidth,
          theme:
            document.querySelector<HTMLElement>(".doc-theme")?.dataset.mode,
          width: window.innerWidth,
        };
      });
      expect({
        busyState,
        desktopLayout,
        emptyState,
        mobileLayout,
        readyState,
        renderedResponse,
        sentMessage,
      }).toStrictEqual({
        busyState: { inputDisabled: true, sendDisabled: true },
        desktopLayout: { inBounds: true, pageFits: true, width: 1280 },
        emptyState: { inputDisabled: false, sendDisabled: true },
        mobileLayout: {
          inBounds: true,
          pageFits: true,
          theme: "dark",
          width: 390,
        },
        readyState: {
          inputEnabled: true,
          inputValue: submittedMessage,
          sendEnabled: true,
        },
        renderedResponse: {
          assistantCode: true,
          assistantListItems: 14,
          assistantTableHeaders: 2,
          bodyCanScroll: true,
          userMarkdown: true,
        },
        sentMessage: submittedMessage,
      });
    } finally {
      await page.close();
    }
  });

  it("shows a chat error and retains the unsent draft", async () => {
    const page = await openWorkspacePage(
      browser,
      html,
      workspaceScript,
      1280,
      () => ({
        body: { error: "Agent service is unavailable." },
        status: 503,
      })
    );
    try {
      await page.locator(".doc-workspace-agent").click();
      const composer = page.getByRole("textbox", { name: "Message to agent" });
      const sendButton = page.getByRole("button", { name: "Send message" });
      await composer.fill("Keep this draft if sending fails.");
      await sendButton.click();
      await page.getByRole("alert").waitFor({ state: "visible" });
      const errorState = {
        draft: await composer.inputValue(),
        error: await page.getByRole("alert").textContent(),
        sendEnabled: await sendButton.isEnabled(),
      };
      expect(errorState).toStrictEqual({
        draft: "Keep this draft if sending fails.",
        error: "Agent service is unavailable.",
        sendEnabled: true,
      });
    } finally {
      await page.close();
    }
  });
});

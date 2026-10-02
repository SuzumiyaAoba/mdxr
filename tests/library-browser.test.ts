import path from "node:path";

import { build } from "esbuild";
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { libraryHtml } from "../src/library-page.js";
import type {
  LibraryResult,
  LibrarySearchResponse,
} from "../src/library-types.js";

const ORIGIN = "http://library.test";
const DOCUMENT_ID = "20260929/認証 計画.mdx";
const DOCUMENT_TITLE = "Auth plan <script>window.bad=true</script>";
const RESULTS: LibraryResult[] = [
  {
    excerpt: "Auth uses short lived tokens to protect each session.",
    excerptMatches: [{ end: 4, start: 0 }],
    id: DOCUMENT_ID,
    path: DOCUMENT_ID,
    status: "doing",
    title: DOCUMENT_TITLE,
    titleMatches: [{ end: 4, start: 0 }],
    updatedAt: "2026-09-29T01:02:00.000Z",
  },
];
const RETAINED_RESULT: LibraryResult = {
  excerpt: "削除後も一覧に残る文書です。",
  excerptMatches: [],
  id: "20260929/残す文書.mdx",
  path: "20260929/残す文書.mdx",
  status: "todo",
  title: "残す文書",
  titleMatches: [],
  updatedAt: "2026-09-28T01:02:00.000Z",
};

const RESPONSE: LibrarySearchResponse = {
  matched: 1,
  results: RESULTS,
  root: "/project/.mdxr",
  statuses: ["todo", "doing", "done", "blocked", "custom"],
  total: 1,
  warnings: [],
};
const AFTER_DELETE_RESPONSE: LibrarySearchResponse = {
  ...RESPONSE,
  results: [RETAINED_RESULT],
};

interface SearchRequest {
  q: string;
  sort: string;
  status: string | null;
}

interface SearchReply {
  body: LibrarySearchResponse;
  status?: number;
}

interface DeleteRequest {
  action: string | undefined;
  id: string;
  method: string;
  url: string;
}

interface DeleteReply {
  body?: unknown;
  status: number;
}

type SearchHandler = (
  request: SearchRequest
) => SearchReply | Promise<SearchReply>;
type DeleteHandler = (id: string) => DeleteReply | Promise<DeleteReply>;

interface LibraryThemeSnapshot {
  background: string;
  colorScheme: string;
  dark: boolean;
  label: string | null;
  localStorageAvailable: boolean;
  mode: string | undefined;
  foreground: string;
  storedTheme: string | null;
}

const readLibraryTheme = async (page: Page): Promise<LibraryThemeSnapshot> => {
  const snapshot = await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>(
      "button[data-doc-theme]"
    );
    const { body } = document;
    let localStorageAvailable = true;
    let storedTheme: string | null = null;
    try {
      storedTheme = window.localStorage.getItem("doc-theme");
    } catch {
      localStorageAvailable = false;
    }
    return {
      background: getComputedStyle(body).backgroundColor,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      dark: document.documentElement.classList.contains("dark"),
      foreground: getComputedStyle(body).color,
      label: button?.getAttribute("aria-label") ?? null,
      localStorageAvailable,
      mode: button?.dataset.mode,
      storedTheme,
    };
  });
  return snapshot;
};

const changeSystemColorScheme = async (
  page: Page,
  colorScheme: "dark" | "light"
): Promise<void> => {
  await page.evaluate(() => {
    const root = document.documentElement;
    root.dataset.themeTestPreferenceChanged = "false";
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener(
      "change",
      () => {
        root.dataset.themeTestPreferenceChanged = "true";
      },
      { once: true }
    );
  });
  await page.emulateMedia({ colorScheme });
  await page.waitForFunction(
    () => document.documentElement.dataset.themeTestPreferenceChanged === "true"
  );
  await page.evaluate(() => {
    delete document.documentElement.dataset.themeTestPreferenceChanged;
  });
};

interface LibraryPageOptions {
  blockLocalStorage?: boolean;
  colorScheme?: "dark" | "light";
  deleteHandler?: DeleteHandler;
  initialTheme?: "dark" | "light";
}

const openLibraryPage = async (
  browser: Browser,
  bundle: string,
  handler: SearchHandler = () => ({ body: RESPONSE }),
  options: LibraryPageOptions = {}
): Promise<{
  deleteRequests: DeleteRequest[];
  page: Page;
  requests: SearchRequest[];
}> => {
  const page = await browser.newPage({
    colorScheme: options.colorScheme ?? "light",
    locale: "ja-JP",
    viewport: { height: 900, width: 1280 },
  });
  if (options.blockLocalStorage === true) {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("Storage is unavailable", "SecurityError");
        },
      });
    });
  } else if (options.initialTheme !== undefined) {
    await page.addInitScript((theme) => {
      window.localStorage.setItem("doc-theme", theme);
    }, options.initialTheme);
  }
  const requests: SearchRequest[] = [];
  const deleteRequests: DeleteRequest[] = [];
  await page.context().route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/__doc_library/search") {
      const request = {
        q: url.searchParams.get("q") ?? "",
        sort: url.searchParams.get("sort") ?? "",
        status: url.searchParams.get("status"),
      };
      requests.push(request);
      const reply = await handler(request);
      await route.fulfill({
        body: JSON.stringify(reply.body),
        contentType: "application/json",
        status: reply.status ?? 200,
      });
      return;
    }
    if (url.pathname.startsWith("/__doc_library/document/")) {
      const id = decodeURIComponent(
        url.pathname.slice("/__doc_library/document/".length)
      );
      const requestHeaders = route.request().headers();
      deleteRequests.push({
        action: requestHeaders["x-doc-library-action"],
        id,
        method: route.request().method(),
        url: route.request().url(),
      });
      const reply = (await options.deleteHandler?.(id)) ?? { status: 204 };
      await route.fulfill({
        body: reply.body === undefined ? "" : JSON.stringify(reply.body),
        contentType: "application/json",
        status: reply.status,
      });
      return;
    }
    if (url.pathname === "/__doc_library.js") {
      await route.fulfill({
        body: bundle,
        contentType: "text/javascript; charset=utf-8",
      });
      return;
    }
    if (url.pathname.startsWith("/__doc_library/open/")) {
      await route.fulfill({
        body: "<!doctype html><html><body><h1>Opened document</h1></body></html>",
        contentType: "text/html",
      });
      return;
    }
    const shell = await libraryHtml();
    await route.fulfill({
      body: shell,
      contentType: "text/html",
    });
  });
  await page.goto(ORIGIN);
  await page.locator("#doc-library-root").waitFor({ state: "attached" });
  return { deleteRequests, page, requests };
};

describe("document library browser UI", () => {
  let browser: Browser;
  let bundle: string;

  beforeAll(async () => {
    browser = await chromium.launch();
    const result = await build({
      bundle: true,
      define: { "process.env.NODE_ENV": '"production"' },
      entryPoints: [path.join(process.cwd(), "src/library-app.tsx")],
      format: "iife",
      jsx: "automatic",
      jsxImportSource: "react",
      platform: "browser",
      target: "es2022",
      write: false,
    });
    const [output] = result.outputFiles;
    if (output === undefined) {
      throw new Error("Library browser bundle was not generated");
    }
    bundle = output.text;
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  it("starts in Japanese, localizes statuses, and preserves an English choice", async () => {
    const { page } = await openLibraryPage(browser, bundle);
    try {
      const japaneseHeading = page.getByRole("heading", {
        level: 1,
        name: "文書ライブラリ",
      });
      const japaneseMain = page.getByRole("main", {
        name: "文書ライブラリ",
      });
      await japaneseMain.waitFor({ state: "visible" });
      expect({
        deleteLabel: await page
          .locator(".doc-library__card")
          .getByRole("button", {
            exact: true,
            name: `${DOCUMENT_TITLE}を削除`,
          })
          .getAttribute("aria-label"),
        documentLanguage: await page.locator("html").getAttribute("lang"),
        documentTitle: await page.title(),
        mainLandmarkCount: await japaneseMain.count(),
        themeLabel: await page
          .locator("button[data-doc-theme]")
          .getAttribute("aria-label"),
        titleHeadingCount: await japaneseHeading.count(),
        translatedStatus: await page
          .locator('.doc-library__status[data-status="doing"]')
          .isVisible(),
      }).toStrictEqual({
        deleteLabel: `${DOCUMENT_TITLE}を削除`,
        documentLanguage: "ja",
        documentTitle: "文書ライブラリ",
        mainLandmarkCount: 1,
        themeLabel: "テーマを切り替え（現在：自動）",
        titleHeadingCount: 0,
        translatedStatus: true,
      });

      await page.getByRole("button", { name: "英語に切り替え" }).click();
      const englishMain = page.getByRole("main", {
        name: "Document library",
      });
      await englishMain.waitFor({ state: "visible" });
      await page.waitForFunction(() => document.documentElement.lang === "en");
      expect({
        deleteLabel: await page
          .locator(".doc-library__card")
          .getByRole("button", {
            exact: true,
            name: `Delete ${DOCUMENT_TITLE}`,
          })
          .getAttribute("aria-label"),
        documentLanguage: await page.locator("html").getAttribute("lang"),
        documentTitle: await page.title(),
        doingOptionCount: await page.locator('option[value="doing"]').count(),
        mainLandmarkCount: await englishMain.count(),
        storedLanguage: await page.evaluate(() =>
          localStorage.getItem("doc:library:language")
        ),
        themeLabel: await page
          .locator("button[data-doc-theme]")
          .getAttribute("aria-label"),
        titleHeadingCount: await page.locator("h1").count(),
      }).toStrictEqual({
        deleteLabel: `Delete ${DOCUMENT_TITLE}`,
        documentLanguage: "en",
        documentTitle: "Document library",
        doingOptionCount: 1,
        mainLandmarkCount: 1,
        storedLanguage: "en",
        themeLabel: "Switch theme (current: System)",
        titleHeadingCount: 0,
      });

      await page.reload();
      await page.getByRole("main", { name: "Document library" }).waitFor();
      await page
        .getByRole("button", { name: "Switch language to Japanese" })
        .waitFor({ state: "visible" });
    } finally {
      await page.close();
    }
  });

  it("follows system color, cycles modes, and restores a saved theme", async () => {
    const { page } = await openLibraryPage(browser, bundle, undefined, {
      colorScheme: "light",
      initialTheme: "dark",
    });
    try {
      const themeButton = page.locator("button[data-doc-theme]");
      await page.getByRole("main", { name: "文書ライブラリ" }).waitFor();
      await themeButton.waitFor({ state: "visible" });

      const savedDark = await readLibraryTheme(page);

      await page.reload();
      await page.getByRole("main", { name: "文書ライブラリ" }).waitFor();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLButtonElement>("button[data-doc-theme]")
            ?.dataset.mode === "dark"
      );
      const restoredDark = await readLibraryTheme(page);
      expect({ restoredDark, savedDark }).toMatchObject({
        restoredDark: {
          colorScheme: "dark",
          dark: true,
          mode: "dark",
          storedTheme: "dark",
        },
        savedDark: {
          colorScheme: "dark",
          dark: true,
          label: "テーマを切り替え（現在：ダーク）",
          localStorageAvailable: true,
          mode: "dark",
          storedTheme: "dark",
        },
      });

      await themeButton.click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLButtonElement>("button[data-doc-theme]")
            ?.dataset.mode === "auto" &&
          !document.documentElement.classList.contains("dark")
      );
      const autoLight = await readLibraryTheme(page);
      await changeSystemColorScheme(page, "dark");
      await page.waitForFunction(() =>
        document.documentElement.classList.contains("dark")
      );
      const systemDark = await readLibraryTheme(page);
      await changeSystemColorScheme(page, "light");
      await page.waitForFunction(
        () => !document.documentElement.classList.contains("dark")
      );
      const systemLight = await readLibraryTheme(page);
      expect({
        autoLight,
        changedColors:
          systemDark.background !== systemLight.background &&
          systemDark.foreground !== systemLight.foreground,
        systemDark,
        systemLight,
      }).toMatchObject({
        autoLight: {
          colorScheme: "light",
          dark: false,
          mode: "auto",
          storedTheme: null,
        },
        changedColors: true,
        systemDark: {
          colorScheme: "dark",
          dark: true,
          label: "テーマを切り替え（現在：自動）",
          mode: "auto",
          storedTheme: null,
        },
        systemLight: {
          colorScheme: "light",
          dark: false,
          mode: "auto",
          storedTheme: null,
        },
      });

      await themeButton.click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLButtonElement>("button[data-doc-theme]")
            ?.dataset.mode === "light"
      );
      const explicitLight = await readLibraryTheme(page);
      await changeSystemColorScheme(page, "dark");
      const explicitLightAfterSystemChange = await readLibraryTheme(page);

      await themeButton.click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLButtonElement>("button[data-doc-theme]")
            ?.dataset.mode === "dark" &&
          document.documentElement.classList.contains("dark")
      );
      const explicitDark = await readLibraryTheme(page);
      await page.reload();
      await page.getByRole("main", { name: "文書ライブラリ" }).waitFor();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLButtonElement>("button[data-doc-theme]")
            ?.dataset.mode === "dark"
      );
      const darkAfterReload = await readLibraryTheme(page);
      expect({
        darkAfterReload,
        explicitDark,
        explicitLight,
        explicitLightAfterSystemChange,
      }).toMatchObject({
        darkAfterReload: {
          colorScheme: "dark",
          dark: true,
          label: "テーマを切り替え（現在：ダーク）",
          mode: "dark",
          storedTheme: "dark",
        },
        explicitDark: {
          dark: true,
          mode: "dark",
          storedTheme: "dark",
        },
        explicitLight: {
          dark: false,
          label: "テーマを切り替え（現在：ライト）",
          mode: "light",
          storedTheme: "light",
        },
        explicitLightAfterSystemChange: {
          dark: false,
          mode: "light",
          storedTheme: "light",
        },
      });
    } finally {
      await page.close();
    }
  });

  it("keeps theme switching available when local storage is blocked", async () => {
    const { page } = await openLibraryPage(browser, bundle, undefined, {
      blockLocalStorage: true,
      colorScheme: "light",
    });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });
    try {
      const themeButton = page.locator("button[data-doc-theme]");
      await page.getByRole("main", { name: "文書ライブラリ" }).waitFor();
      await themeButton.waitFor({ state: "visible" });

      await themeButton.click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLButtonElement>("button[data-doc-theme]")
            ?.dataset.mode === "light"
      );
      await themeButton.click();
      await page.waitForFunction(
        () =>
          document.querySelector<HTMLButtonElement>("button[data-doc-theme]")
            ?.dataset.mode === "dark" &&
          document.documentElement.classList.contains("dark")
      );

      const unavailableStorageTheme = await readLibraryTheme(page);
      expect(unavailableStorageTheme).toMatchObject({
        colorScheme: "dark",
        dark: true,
        localStorageAvailable: false,
        mode: "dark",
        storedTheme: null,
      });
      expect(pageErrors).toStrictEqual([]);
    } finally {
      await page.close();
    }
  });

  it("debounces input and waits for IME composition to end before searching", async () => {
    const { page, requests } = await openLibraryPage(browser, bundle);
    try {
      const input = page.getByRole("searchbox", { name: "文書を検索" });
      await page.getByRole("heading", { name: /Auth plan/u }).waitFor();

      const completedSearch = page.waitForRequest((request) => {
        const url = new URL(request.url());
        return (
          url.pathname === "/__doc_library/search" &&
          url.searchParams.get("q") === "認証計画"
        );
      });
      await input.evaluate((element) => {
        if (!(element instanceof HTMLInputElement)) {
          throw new Error("Search input is unavailable");
        }
        element.dispatchEvent(
          new CompositionEvent("compositionstart", { bubbles: true })
        );
        element.value = "認証計画";
        element.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            data: "認証計画",
            inputType: "insertCompositionText",
            isComposing: true,
          })
        );
      });
      await page.waitForTimeout(350);
      expect(requests.some(({ q }) => q === "認証計画")).toBeFalsy();

      await input.evaluate((element) => {
        if (!(element instanceof HTMLInputElement)) {
          throw new Error("Search input is unavailable");
        }
        element.dispatchEvent(
          new CompositionEvent("compositionend", {
            bubbles: true,
            data: "認証計画",
          })
        );
        element.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            data: "認証計画",
            inputType: "insertText",
          })
        );
      });
      const request = await completedSearch;
      expect(new URL(request.url()).searchParams.get("q")).toBe("認証計画");
    } finally {
      await page.close();
    }
  });

  it("highlights matching text safely and opens the encoded document link", async () => {
    const { page } = await openLibraryPage(browser, bundle);
    try {
      await page.getByRole("heading", { name: /Auth plan/u }).waitFor();
      const marks = page.locator("mark");
      await marks.nth(1).waitFor({ state: "attached" });
      expect({
        count: await marks.count(),
        excerpt: await marks.nth(1).textContent(),
        title: await marks.first().textContent(),
        unsafeElements: await page
          .locator(".doc-library__card h2 script")
          .count(),
      }).toStrictEqual({
        count: 2,
        excerpt: "Auth",
        title: "Auth",
        unsafeElements: 0,
      });

      const link = page.getByRole("link", { name: /Auth plan/u });
      const encodedId = encodeURIComponent("20260929/認証 計画.mdx");
      expect({
        href: await link.getAttribute("href"),
        rel: await link.getAttribute("rel"),
        target: await link.getAttribute("target"),
      }).toStrictEqual({
        href: `/__doc_library/open/${encodedId}`,
        rel: "noopener noreferrer",
        target: "_blank",
      });

      const [popup] = await Promise.all([
        page.waitForEvent("popup"),
        link.click(),
      ]);
      await popup
        .getByRole("heading", { name: "Opened document" })
        .waitFor({ state: "visible" });
      await popup.close();
    } finally {
      await page.close();
    }
  });

  it("cancels deletion and Escape without sending a request", async () => {
    const { page, deleteRequests } = await openLibraryPage(browser, bundle);
    try {
      const deleteLabel = `${DOCUMENT_TITLE}を削除`;
      const row = page.locator(".doc-library__card");
      const deleteButton = row.getByRole("button", {
        exact: true,
        name: deleteLabel,
      });
      const dialog = page.getByRole("alertdialog");

      await deleteButton.click();
      await dialog.waitFor({ state: "visible" });
      expect({
        document: await dialog
          .getByText(DOCUMENT_TITLE, { exact: true })
          .count(),
        path: await dialog.getByText(DOCUMENT_ID, { exact: true }).count(),
        title: await dialog
          .getByRole("heading", {
            name: "文書を削除",
          })
          .count(),
      }).toStrictEqual({ document: 1, path: 1, title: 1 });

      await dialog
        .getByRole("button", { exact: true, name: "キャンセル" })
        .click();
      await dialog.waitFor({ state: "hidden" });
      await page.waitForFunction(
        (label) => document.activeElement?.getAttribute("aria-label") === label,
        deleteLabel
      );
      await deleteButton.click();
      await dialog.waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      await page.waitForFunction(
        (label) => document.activeElement?.getAttribute("aria-label") === label,
        deleteLabel
      );

      expect({
        focusedButton: await page.evaluate(() =>
          document.activeElement?.getAttribute("aria-label")
        ),
        remainingRows: await row.count(),
        requests: deleteRequests.length,
      }).toStrictEqual({
        focusedButton: deleteLabel,
        remainingRows: 1,
        requests: 0,
      });
    } finally {
      await page.close();
    }
  });

  it("deletes one document and refreshes the list after a successful response", async () => {
    let deleted = false;
    const { page, deleteRequests, requests } = await openLibraryPage(
      browser,
      bundle,
      () => ({ body: deleted ? AFTER_DELETE_RESPONSE : RESPONSE }),
      {
        deleteHandler: (id) => {
          deleted = id === DOCUMENT_ID;
          return { status: 204 };
        },
      }
    );
    try {
      await page.getByRole("link", { name: /Auth plan/u }).waitFor();
      const row = page.locator(".doc-library__card");
      await row
        .getByRole("button", {
          exact: true,
          name: `${DOCUMENT_TITLE}を削除`,
        })
        .click();
      const dialog = page.getByRole("alertdialog");
      await dialog.waitFor({ state: "visible" });
      await dialog.getByRole("button", { exact: true, name: "削除" }).click();

      await page.getByRole("link", { name: /残す文書/u }).waitFor();
      const [request] = deleteRequests;
      expect({
        deletedDocumentCount: await page
          .getByRole("link", { name: /Auth plan/u })
          .count(),
        refreshed: requests.length > 1,
        remainingRows: await row.count(),
        request:
          request === undefined
            ? undefined
            : {
                action: request.action,
                id: request.id,
                method: request.method,
                path: new URL(request.url).pathname,
              },
        requestCount: deleteRequests.length,
        retainedDocumentVisible: await page
          .getByRole("link", { name: /残す文書/u })
          .isVisible(),
      }).toStrictEqual({
        deletedDocumentCount: 0,
        refreshed: true,
        remainingRows: 1,
        request: {
          action: "delete",
          id: DOCUMENT_ID,
          method: "DELETE",
          path: `/__doc_library/document/${encodeURIComponent(DOCUMENT_ID)}`,
        },
        requestCount: 1,
        retainedDocumentVisible: true,
      });
    } finally {
      await page.close();
    }
  });

  it("keeps the row after a delete failure and allows retry", async () => {
    let deleted = false;
    let attempts = 0;
    const { page, deleteRequests, requests } = await openLibraryPage(
      browser,
      bundle,
      () => ({ body: deleted ? AFTER_DELETE_RESPONSE : RESPONSE }),
      {
        deleteHandler: (id) => {
          attempts += 1;
          if (attempts === 1) {
            return { body: { error: "delete-failed" }, status: 500 };
          }
          deleted = id === DOCUMENT_ID;
          return { status: 204 };
        },
      }
    );
    try {
      await page.getByRole("link", { name: /Auth plan/u }).waitFor();
      const row = page.locator(".doc-library__card");
      await row
        .getByRole("button", {
          exact: true,
          name: `${DOCUMENT_TITLE}を削除`,
        })
        .click();
      const dialog = page.getByRole("alertdialog");
      await dialog.waitFor({ state: "visible" });
      const confirmDelete = dialog.getByRole("button", {
        exact: true,
        name: "削除",
      });
      await confirmDelete.click();
      await dialog
        .getByText("文書を削除できませんでした。もう一度お試しください。", {
          exact: true,
        })
        .waitFor({ state: "visible" });
      const retainedRows = await row.count();
      const retainedDialog = await dialog.isVisible();
      await confirmDelete.click();
      await page.getByRole("link", { name: /残す文書/u }).waitFor();

      expect({
        attempts,
        deletedDocumentCount: await page
          .getByRole("link", { name: /Auth plan/u })
          .count(),
        refreshed: requests.length > 1,
        remainingRows: await row.count(),
        requestActions: deleteRequests.map(({ action, id, method }) => ({
          action,
          id,
          method,
        })),
        retainedDialog,
        retainedDocumentVisible: await page
          .getByRole("link", { name: /残す文書/u })
          .isVisible(),
        retainedRows,
      }).toStrictEqual({
        attempts: 2,
        deletedDocumentCount: 0,
        refreshed: true,
        remainingRows: 1,
        requestActions: [
          { action: "delete", id: DOCUMENT_ID, method: "DELETE" },
          { action: "delete", id: DOCUMENT_ID, method: "DELETE" },
        ],
        retainedDialog: true,
        retainedDocumentVisible: true,
        retainedRows: 1,
      });
    } finally {
      await page.close();
    }
  });

  it("sends status and sort filters and shows an empty-library state", async () => {
    const { page } = await openLibraryPage(
      browser,
      bundle,
      (candidateRequest) => ({
        body:
          candidateRequest.status === "done"
            ? { ...RESPONSE, matched: 0, results: [] }
            : RESPONSE,
      })
    );
    try {
      await page.getByRole("heading", { name: /Auth plan/u }).waitFor();
      const filteredSearch = page.waitForRequest((request) => {
        const url = new URL(request.url());
        return (
          url.pathname === "/__doc_library/search" &&
          url.searchParams.get("status") === "done" &&
          url.searchParams.get("sort") === "title"
        );
      });
      await page.getByLabel("状態").selectOption("done");
      await page.getByLabel("並べ替え").selectOption("title");
      const request = await filteredSearch;
      expect({
        q: new URL(request.url()).searchParams.get("q"),
        sort: new URL(request.url()).searchParams.get("sort"),
        status: new URL(request.url()).searchParams.get("status"),
      }).toStrictEqual({ q: "", sort: "title", status: "done" });
      await page
        .locator(".doc-library__empty")
        .filter({ hasText: "条件に一致する文書がありません。" })
        .waitFor({ state: "visible" });

      const allSearch = page.waitForRequest((candidateRequest) => {
        const url = new URL(candidateRequest.url());
        return (
          url.pathname === "/__doc_library/search" &&
          url.searchParams.get("status") === null &&
          url.searchParams.get("sort") === "relevance"
        );
      });
      await page.getByLabel("状態").selectOption("");
      await page.getByLabel("並べ替え").selectOption("relevance");
      await allSearch;
      await page.getByRole("heading", { name: /Auth plan/u }).waitFor({
        state: "visible",
      });
    } finally {
      await page.close();
    }
  });

  it("uses floating controls without a header and keeps the layout clear on mobile", async () => {
    const { page } = await openLibraryPage(browser, bundle);
    try {
      await page.getByRole("heading", { name: /Auth plan/u }).waitFor();
      const desktopChrome = await page.evaluate(() => {
        const main = document.querySelector<HTMLElement>(
          'main[aria-label="文書ライブラリ"]'
        );
        const controls = document.querySelector<HTMLElement>(
          ".doc-library__controls"
        );
        const controlsBounds = controls?.getBoundingClientRect();
        return {
          controlsFit: Boolean(
            controlsBounds &&
            controlsBounds.left >= 0 &&
            controlsBounds.right <= window.innerWidth
          ),
          controlsPosition: controls
            ? getComputedStyle(controls).position
            : "missing",
          controlsWidth: controlsBounds?.width ?? 0,
          floatingButtonCount: controls?.querySelectorAll("button").length ?? 0,
          headingCount: document.querySelectorAll("#doc-library-root h1")
            .length,
          mainLabel: main?.getAttribute("aria-label") ?? null,
          topBarCount: document.querySelectorAll("#doc-library-root header")
            .length,
        };
      });
      expect(desktopChrome).toMatchObject({
        controlsFit: true,
        controlsPosition: "fixed",
        floatingButtonCount: 2,
        headingCount: 0,
        mainLabel: "文書ライブラリ",
        topBarCount: 0,
      });
      expect(desktopChrome.controlsWidth).toBeLessThan(1280);

      await page.setViewportSize({ height: 844, width: 390 });
      const layout = await page.evaluate(() => {
        const root = document.querySelector<HTMLElement>("#doc-library-root");
        const list = document.querySelector<HTMLElement>(".doc-library__list");
        const card = document.querySelector<HTMLElement>(".doc-library__card");
        const controls = document.querySelector<HTMLElement>(
          ".doc-library__controls"
        );
        const search = document.querySelector<HTMLElement>(
          ".doc-library__search-field"
        );
        const rootBounds = root?.getBoundingClientRect();
        const cardBounds = card?.getBoundingClientRect();
        const controlsBounds = controls?.getBoundingClientRect();
        const searchBounds = search?.getBoundingClientRect();
        return {
          cardFits: Boolean(
            rootBounds &&
            cardBounds &&
            cardBounds.left >= rootBounds.left &&
            cardBounds.right <= rootBounds.right
          ),
          columnCount: list
            ? getComputedStyle(list).gridTemplateColumns.split(" ").length
            : 0,
          controlsDoNotOverlapSearch: Boolean(
            controlsBounds &&
            searchBounds &&
            (controlsBounds.bottom <= searchBounds.top ||
              controlsBounds.top >= searchBounds.bottom ||
              controlsBounds.right <= searchBounds.left ||
              controlsBounds.left >= searchBounds.right)
          ),
          controlsPosition: controls
            ? getComputedStyle(controls).position
            : "missing",
          documentWidth: document.documentElement.scrollWidth,
        };
      });
      expect(layout).toStrictEqual({
        cardFits: true,
        columnCount: 1,
        controlsDoNotOverlapSearch: true,
        controlsPosition: "fixed",
        documentWidth: 390,
      });
    } finally {
      await page.close();
    }
  });

  it("announces an empty library and a network error", async () => {
    const emptyResponse: LibrarySearchResponse = {
      matched: 0,
      results: [],
      root: "/project/.mdxr",
      statuses: [],
      total: 0,
      warnings: [],
    };
    const { page } = await openLibraryPage(browser, bundle, () => ({
      body: emptyResponse,
    }));
    try {
      await page
        .getByText("このライブラリには Markdown・MDX 文書がありません。")
        .waitFor({ state: "visible" });
      await expect(
        page
          .getByText("このライブラリには Markdown・MDX 文書がありません。")
          .isVisible()
      ).resolves.toBeTruthy();
    } finally {
      await page.close();
    }

    const errorPage = await openLibraryPage(browser, bundle, () => ({
      body: RESPONSE,
      status: 500,
    }));
    try {
      await errorPage.page
        .getByRole("alert")
        .getByText(
          "文書ライブラリを読み込めませんでした。再読み込みしてください。"
        )
        .waitFor({ state: "visible" });
      await errorPage.page
        .getByRole("alert")
        .getByRole("button", { name: "一覧を更新" })
        .waitFor({ state: "visible" });
    } finally {
      await errorPage.page.close();
    }
  });
});

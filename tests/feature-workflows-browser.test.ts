import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";
import type { Browser, BrowserContext, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseAnnotationDocument } from "../src/annotations.js";
import { isRecord } from "../src/guards.js";
import { parseReviewTransfer } from "../src/review-transfer.js";
import type { ReviewTransfer } from "../src/review-transfer.js";
import { serve } from "../src/serve.js";

const SOURCE = `---
id: workflow-document
title: Workflow document
---

## Design

Original review quote.

<Ask id="decisions" title="Decisions">
  <Question name="answer" label="Answer" type="text" />
  <Question name="choice" label="Choice" type="select"><Choice value="a">Alpha</Choice><Choice value="b">Beta</Choice></Question>
</Ask>

<Board id="tasks" title="Tasks">
  <Lane id="todo" title="Todo"><BoardCard id="a" title="Duplicate" /><BoardCard id="b" title="Duplicate" /></Lane>
  <Lane id="done" title="Done" />
</Board>
`;

const serverUrl = (server: Server): string => {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Server is not listening");
  }
  return `http://127.0.0.1:${address.port}/`;
};
const closeServer = async (server: Server): Promise<void> => {
  server.closeAllConnections();
  server.close();
  await once(server, "close");
};
const fixture = async (
  browser: Browser | BrowserContext,
  source = SOURCE,
  files: Record<string, string> = {}
) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-feature-browser-"));
  const outputDir = await mkdtemp(
    path.join(os.tmpdir(), "mdxr-feature-output-")
  );
  const file = path.join(dir, "index.mdx");
  await writeFile(file, source);
  for (const [name, content] of Object.entries(files)) {
    // oxlint-disable-next-line no-await-in-loop
    await writeFile(path.join(dir, name), content);
  }
  const server = await serve(file, 0);
  const page = await browser.newPage();
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  await page.goto(serverUrl(server));
  await page.getByRole("button", { name: "Validation diagnostics" }).waitFor();
  return {
    close: async () => {
      await page.close();
      await closeServer(server);
      await rm(dir, { force: true, recursive: true });
      await rm(outputDir, { force: true, recursive: true });
    },
    dir,
    errors,
    file,
    outputDir,
    page,
    server,
  };
};
const importReview = async (
  page: Page,
  review: ReviewTransfer
): Promise<void> => {
  await page.getByLabel("Import review JSON").setInputFiles({
    buffer: Buffer.from(JSON.stringify(review)),
    mimeType: "application/json",
    name: "review.json",
  });
};

describe("complete document workflows in the real preview", () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  it("restores Ask answers and individually identified Board cards, retaining incompatible answers", async () => {
    const app = await fixture(browser);
    try {
      await app.page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>('[data-card-id="a"]')?.dataset
            .widgetIdentity !== undefined
      );
      await app.page.getByLabel("Answer", { exact: true }).fill("Saved answer");
      await app.page.getByLabel("Choice", { exact: true }).selectOption("b");
      await app.page
        .locator('[data-card-id="a"]')
        .getByRole("button", { name: "Move to next lane" })
        .click();
      await app.page.reload();
      await app.page.waitForFunction(
        () =>
          document.querySelector('[data-lane-id="done"] [data-card-id="a"]') !==
          null
      );
      expect({
        answer: await app.page
          .getByLabel("Answer", { exact: true })
          .inputValue(),
        choice: await app.page
          .getByLabel("Choice", { exact: true })
          .inputValue(),
        otherCard: await app.page
          .locator('[data-lane-id="todo"] [data-card-id="b"]')
          .count(),
      }).toStrictEqual({ answer: "Saved answer", choice: "b", otherCard: 1 });
      await writeFile(
        app.file,
        SOURCE.replace(
          '<Choice value="b">Beta</Choice>',
          '<Choice value="c">Gamma</Choice>'
        )
      );
      await app.page
        .getByText("Gamma", { exact: true })
        .waitFor({ state: "attached" });
      await app.page.locator("#doc-widget-status").waitFor();
      await expect(
        app.page.getByLabel("Choice", { exact: true }).inputValue()
      ).resolves.toBe("a");
      await expect(
        app.page.getByLabel("Answer", { exact: true }).inputValue()
      ).resolves.toBe("Saved answer");
      await expect(
        app.page.locator("#doc-widget-status").textContent()
      ).resolves.toContain("original records are retained");
      expect(app.errors).toStrictEqual([]);
    } finally {
      await app.close();
    }
  });

  it("retains answers and board moves saved by another tab", async () => {
    const context = await browser.newContext();
    const app = await fixture(context);
    try {
      const second = await context.newPage();
      await second.goto(serverUrl(app.server));
      for (const page of [app.page, second]) {
        // oxlint-disable-next-line no-await-in-loop
        await page.waitForFunction(
          () =>
            document.querySelector<HTMLElement>("[data-ask-id]")?.dataset
              .widgetIdentity !== undefined
        );
      }
      await app.page.getByLabel("Answer", { exact: true }).fill("First tab");
      await app.page
        .locator('[data-card-id="a"]')
        .getByRole("button", { name: "Move to next lane" })
        .click();
      await second.getByLabel("Choice", { exact: true }).selectOption("b");
      await app.page.reload();
      await app.page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>("[data-ask-id]")?.dataset
            .widgetIdentity !== undefined
      );

      expect({
        answer: await app.page
          .getByLabel("Answer", { exact: true })
          .inputValue(),
        choice: await app.page
          .getByLabel("Choice", { exact: true })
          .inputValue(),
        movedCards: await app.page
          .locator('[data-lane-id="done"] [data-card-id="a"]')
          .count(),
      }).toStrictEqual({ answer: "First tab", choice: "b", movedCards: 1 });
      expect(app.errors).toStrictEqual([]);
    } finally {
      await context.close();
      await closeServer(app.server);
      await rm(app.dir, { force: true, recursive: true });
      await rm(app.outputDir, { force: true, recursive: true });
    }
  });

  it("preserves malformed saved answers introduced after the page loaded", async () => {
    const app = await fixture(browser);
    try {
      await app.page.waitForFunction(
        () =>
          document.querySelector<HTMLElement>("[data-ask-id]")?.dataset
            .widgetIdentity !== undefined
      );
      await app.page.getByLabel("Answer", { exact: true }).fill("Saved answer");
      const storageKey = await app.page.evaluate(() => {
        const key = Object.keys(localStorage).find((candidate) =>
          candidate.startsWith("doc:widgets:v1:")
        );
        if (key === undefined) {
          throw new Error("Missing saved widget state");
        }
        localStorage.setItem(key, "{broken");
        return key;
      });
      await app.page
        .getByLabel("Answer", { exact: true })
        .fill("Changed answer");

      await expect(
        app.page.evaluate((key) => localStorage.getItem(key), storageKey)
      ).resolves.toBe("{broken");
      await expect(
        app.page.locator("#doc-widget-status").textContent()
      ).resolves.toContain(
        "Saved answers could not be read. Existing data was retained."
      );
      expect(app.errors).toStrictEqual([]);
    } finally {
      await app.close();
    }
  });

  it("imports, saves and idempotently merges comments and section reviews with explicit document mapping", async () => {
    const app = await fixture(browser);
    try {
      const info = parseAnnotationDocument(
        (await app.page.locator("#doc-annotation-document").textContent()) ??
          "{}"
      );
      if (info === undefined) {
        throw new Error("Missing document metadata");
      }
      const section = await app.page
        .locator("doc-section-review")
        .first()
        .evaluate((element) => ({
          id: element.dataset.sectionId ?? "",
          revision: element.dataset.sectionRevision ?? "",
          title: element.dataset.sectionTitle ?? "",
        }));
      const review: ReviewTransfer = {
        annotations: {
          annotations: [
            {
              anchor: {
                end: 5,
                heading: "Design",
                image: "",
                kind: "text",
                path: [],
                prefix: "",
                quote: "Original review quote.",
                revision: "previous",
                start: 0,
                suffix: "",
              },
              comment: "Transferred comment",
              id: "comment-1",
            },
          ],
          history: [],
        },
        document: {
          file: "moved.mdx",
          id: "other-document",
          revision: "previous",
          title: "Review",
        },
        exportedAt: new Date().toISOString(),
        format: "doc-review",
        sections: [section],
        version: 1,
      };
      await app.page
        .getByRole("button", { name: "Save or import review" })
        .click();
      await importReview(app.page, review);
      await expect(
        app.page.getByRole("button", { name: "Merge review" }).isDisabled()
      ).resolves.toBeTruthy();
      await app.page.getByRole("checkbox", { name: /Map reviews/u }).check();
      await app.page.getByRole("button", { name: "Merge review" }).click();
      await expect(
        app.page.getByRole("dialog").textContent()
      ).resolves.toContain("1 added");
      const downloadPromise = app.page.waitForEvent("download");
      await app.page
        .getByRole("button", { name: "Download review JSON" })
        .click();
      const download = await downloadPromise;
      const output = path.join(app.outputDir, "review.json");
      await download.saveAs(output);
      const saved = parseReviewTransfer(await readFile(output, "utf-8"));
      expect({
        comment: saved.annotations.annotations[0]?.comment,
        id: saved.document.id,
        sections: saved.sections.length,
      }).toStrictEqual({
        comment: "Transferred comment",
        id: "workflow-document",
        sections: 1,
      });
      await importReview(app.page, saved);
      await app.page.getByRole("button", { name: "Merge review" }).waitFor();
      await expect(
        app.page.getByRole("dialog").textContent()
      ).resolves.toContain("0 new records");
      await app.page.getByRole("button", { name: "Merge review" }).click();
      const merged = await app.page.getByRole("dialog").textContent();
      expect({
        errors: app.errors,
        result: merged?.includes("0 added"),
      }).toStrictEqual({ errors: [], result: true });
    } finally {
      await app.close();
    }
  });

  it("keeps diagnostics and source navigation available when rendering fails", async () => {
    const app = await fixture(
      browser,
      '# Invalid document\n\n<Step status="unknown" />'
    );
    try {
      await app.page
        .getByRole("button", { name: "Validation diagnostics" })
        .click();
      const diagnostic = app.page
        .getByRole("dialog")
        .getByRole("button", { name: /mdxr:invalid-props/u });
      await diagnostic.click();
      await expect(
        app.page.getByRole("textbox", { name: /Raw MDX/u }).inputValue()
      ).resolves.toContain('status="unknown"');
      await expect(
        app.page
          .getByRole("textbox", { name: /Raw MDX/u })
          .evaluate((element) =>
            element instanceof HTMLTextAreaElement ? element.selectionStart : -1
          )
      ).resolves.toBeGreaterThan(0);
      const forbidden = await fetch(
        `${serverUrl(app.server)}__doc_diagnostic_source?file=${encodeURIComponent("/etc/passwd")}`
      );
      expect(forbidden.status).toBe(404);
      expect(app.errors).toStrictEqual([]);
    } finally {
      await app.close();
    }
  });

  it("shows captured dependency hashes and detects changes without rewriting the document", async () => {
    const app = await fixture(
      browser,
      '# History\n\n<Include path="part.md" />',
      { "part.md": "DEPENDENCY_FIRST" }
    );
    try {
      const response = await fetch(`${serverUrl(app.server)}__doc_history`);
      const history: unknown = await response.json();
      if (!isRecord(history) || typeof history.latestId !== "string") {
        throw new Error("Missing latest version");
      }
      await app.page
        .getByRole("button", { name: "Dependency manifest" })
        .click();
      await app.page
        .getByRole("dialog")
        .getByText(/part\.md/u)
        .waitFor();
      await expect(
        app.page.getByRole("dialog").textContent()
      ).resolves.toContain("unchanged");
      await app.page
        .getByRole("dialog")
        .getByRole("button", { exact: true, name: "Close" })
        .click();
      await writeFile(path.join(app.dir, "part.md"), "DEPENDENCY_CHANGED");
      await app.page.getByText("DEPENDENCY_CHANGED", { exact: true }).waitFor();
      await app.page.getByRole("button", { exact: true, name: "MDX" }).click();
      await app.page
        .getByRole("combobox", { name: "Document version" })
        .selectOption(history.latestId);
      await app.page
        .getByRole("button", { name: "Dependency manifest" })
        .click();
      const dependency = app.page
        .getByRole("dialog")
        .locator("li")
        .filter({ hasText: "part.md" });
      await dependency.getByText("changed", { exact: true }).waitFor();
      await expect(
        app.page.getByRole("dialog").locator("time").getAttribute("datetime")
      ).resolves.toMatch(/^\d{4}-\d{2}-\d{2}T/u);
      await expect(dependency.locator("code").textContent()).resolves.toMatch(
        /^[\da-f]{64}$/u
      );
      expect(app.errors).toStrictEqual([]);
    } finally {
      await app.close();
    }
  });

  it.each([false, true])(
    "exports nested related documents offline, including already opened links: %s",
    async (openLink) => {
      const app = await fixture(
        browser,
        '# Root\n\n<DocumentLink path="child.mdx" label="Child document" />\n\n<DocumentLink path="child.mdx" label="Same child" />',
        {
          "child.mdx":
            '# Child\n\nCHILD_OFFLINE_MARKER\n\n<DocumentLink path="nested.mdx" label="Nested document" />',
          "nested.mdx": "# Nested\n\nNESTED_OFFLINE_MARKER",
        }
      );
      let closed = false;
      try {
        await app.page.locator("a[data-doc-document]").first().waitFor();
        if (openLink) {
          await app.page
            .getByRole("link", { name: /^Child document/u })
            .focus();
          const [popup] = await Promise.all([
            app.page.waitForEvent("popup"),
            app.page.keyboard.press("Enter"),
          ]);
          await popup.close();
        }
        await app.page
          .getByRole("button", { exact: true, name: "Export HTML" })
          .click();
        await app.page.getByRole("radio", { name: "Document only" }).focus();
        await app.page.keyboard.press("Space");
        await app.page
          .getByRole("checkbox", {
            name: "Include related documents for offline reading",
          })
          .check();
        const downloadPromise = app.page.waitForEvent("download", {
          timeout: 45_000,
        });
        await app.page.getByRole("button", { name: "Download HTML" }).click();
        const download = await downloadPromise;
        const output = path.join(app.outputDir, "offline.html");
        await download.saveAs(output);
        await app.page.close();
        await closeServer(app.server);
        closed = true;
        const offline = await browser.newContext();
        const requests: string[] = [];
        await offline.route(/^https?:\/\//u, async (route) => {
          requests.push(route.request().url());
          await route.abort();
        });
        try {
          const page = await offline.newPage();
          await page.goto(pathToFileURL(output).href);
          await expect(
            page.locator("[data-doc-related]").count()
          ).resolves.toBe(2);
          await page.getByRole("link", { name: /^Child document/u }).click();
          expect(page.url()).toContain("#doc-related-");
          await page.getByRole("link", { name: /^Nested document/u }).click();
          await expect(page.locator("body").textContent()).resolves.toContain(
            "NESTED_OFFLINE_MARKER"
          );

          const ids = await page
            .locator("[id]")
            .evaluateAll((elements) => elements.map((element) => element.id));
          expect({
            requests,
            scripts: await page.locator("script").count(),
            uniqueIds: new Set(ids).size === ids.length,
          }).toStrictEqual({ requests: [], scripts: 0, uniqueIds: true });
        } finally {
          await offline.close();
        }
      } finally {
        if (!closed) {
          await app.page.close();
          await closeServer(app.server);
        }
        await rm(app.dir, { force: true, recursive: true });
        await rm(app.outputDir, { force: true, recursive: true });
      }
    },
    90_000
  );
});

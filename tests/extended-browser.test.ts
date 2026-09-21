import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { render } from "../src/render.js";
import specimens from "./fixtures/extended-catalog.json";

const sourceOf = (name: string): string =>
  specimens.find((item) => item.name === name)?.source ?? "";

describe("extended document interactions", () => {
  let browser: Browser;
  let page: Page;
  let errors: string[];
  beforeAll(async () => {
    browser = await chromium.launch();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    page.setDefaultTimeout(5000);
    errors = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    page.on("console", (message) => {
      if (/hydration|hydrating|Minified React error/iu.test(message.text())) {
        errors.push(message.text());
      }
    });
  });
  afterEach(async () => {
    await page?.close();
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("sorts numerically, paginates, searches and exports the filtered table", async () => {
    const source = sourceOf("DataTable").replace(
      "<DataTable ",
      '<DataTable title="Inventory" pageSize="2" '
    );
    await page.setContent(await render(source, { hydrate: true }));
    const table = page.getByRole("region", { name: "Inventory" });
    await expect
      .poll(
        async () =>
          await table.locator("table").first().locator("tbody tr").count()
      )
      .toBe(2);
    await table.getByRole("button", { exact: true, name: "value" }).click();
    await expect
      .poll(async () => await table.locator("tbody tr").first().textContent())
      .toContain("Beta");
    await table.getByRole("button", { exact: true, name: "Next" }).click();
    await expect
      .poll(async () => await table.locator("table").first().textContent())
      .toContain("Gamma");
    await table.getByLabel("Search table").fill("alpha");
    await expect
      .poll(
        async () =>
          await table.locator("table").first().locator("tbody tr").count()
      )
      .toBe(1);
    const downloadPromise = page.waitForEvent("download");
    await table.getByRole("button", { name: "Save CSV" }).click();
    const download = await downloadPromise;
    const file = await download.path();
    expect(file).not.toBeNull();
    const csv = await readFile(file ?? "", "utf-8");
    expect(csv).toContain("Alpha");
    expect(csv).not.toContain("Beta");
    expect(errors).toStrictEqual([]);
  });

  it("shares categorical filters with both reports and plots", async () => {
    await page.setContent(
      await render(sourceOf("FilterPanel"), { hydrate: true })
    );
    await page.getByLabel("status", { exact: true }).selectOption("pending");
    await expect
      .poll(
        async () =>
          await page.locator("table").first().locator("tbody tr").count()
      )
      .toBe(1);
    await expect
      .poll(
        async () =>
          await page
            .getByRole("region", { name: "DotPlot" })
            .locator("svg circle")
            .count()
      )
      .toBe(1);
    await page.getByRole("button", { name: "Reset filters" }).click();
    await expect
      .poll(
        async () =>
          await page
            .getByRole("region", { name: "DotPlot" })
            .locator("svg circle")
            .count()
      )
      .toBe(2);
    expect(errors).toStrictEqual([]);
  });

  it("synchronizes tabs and supports keyboard selection and printing", async () => {
    await page.setContent(
      await render(sourceOf("SyncedTabs"), { hydrate: true })
    );
    await page.getByRole("tab", { exact: true, name: "Linux" }).first().focus();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(
        async () =>
          await page.getByRole("tab", { name: "macOS", selected: true }).count()
      )
      .toBe(2);
    await expect
      .poll(async () => await page.getByRole("tabpanel").count())
      .toBe(2);
    await page.emulateMedia({ media: "print" });
    await expect
      .poll(async () => await page.locator('[role="tabpanel"]:visible').count())
      .toBe(4);
    expect(errors).toStrictEqual([]);
  });

  it("updates checklist progress, keyboard ranking and calculator results", async () => {
    await page.setContent(
      await render(
        ["Checklist", "Ranking", "Calculator"].map(sourceOf).join("\n\n"),
        { hydrate: true }
      )
    );
    await page.getByLabel("Review changes").check();
    await expect
      .poll(
        async () =>
          await page.getByRole("region", { name: "Checklist" }).textContent()
      )
      .toContain("2 / 2");
    await page.getByRole("button", { name: "Move Clarity up" }).click();
    await expect
      .poll(
        async () =>
          await page
            .getByRole("region", { name: "Ranking" })
            .locator("li")
            .first()
            .textContent()
      )
      .toContain("Clarity");
    await page.getByLabel("Users", { exact: true }).fill("3");
    await expect
      .poll(
        async () =>
          await page
            .getByRole("region", { name: "Calculator" })
            .locator("output")
            .textContent()
      )
      .toBe("36 USD");
    await page.getByLabel("Price", { exact: true }).fill("-1");
    await expect
      .poll(
        async () =>
          await page
            .getByRole("region", { name: "Calculator" })
            .locator("output")
            .textContent()
      )
      .toContain("Enter valid values");
    expect(errors).toStrictEqual([]);
  });

  it("branches wizard questions and imports typed answers into Ask", async () => {
    await page.setContent(
      await render(`${sourceOf("Wizard")}\n\n${sourceOf("AnswerSheet")}`, {
        hydrate: true,
      })
    );
    await page.getByLabel("Target", { exact: true }).selectOption("Web");
    await page
      .getByRole("region", { name: "Questionnaire" })
      .getByRole("button", { exact: true, name: "Next" })
      .click();
    await expect
      .poll(
        async () => await page.getByLabel("Site URL", { exact: true }).count()
      )
      .toBe(1);
    await page
      .getByLabel("Site URL", { exact: true })
      .fill("https://example.com");
    await page.getByLabel("Import answers").setInputFiles({
      buffer: Buffer.from(JSON.stringify({ project: "MDXR", ready: true })),
      mimeType: "application/json",
      name: "answers.json",
    });
    await expect
      .poll(
        async () =>
          await page.getByLabel("Project name", { exact: true }).inputValue()
      )
      .toBe("MDXR");
    await expect(
      page.getByLabel("Ready", { exact: true }).isChecked()
    ).resolves.toBeTruthy();
    await expect
      .poll(async () => await page.locator("[data-ask-output]").textContent())
      .toContain("MDXR");
    await page.getByLabel("Import answers").setInputFiles({
      buffer: Buffer.from("[]"),
      mimeType: "application/json",
      name: "bad.json",
    });
    await expect
      .poll(async () => await page.getByRole("alert").textContent())
      .toContain("JSON object");
    expect(errors).toStrictEqual([]);
  });

  it("opens and dismisses the gallery, compares images, searches and fills prompt variables", async () => {
    await page.setContent(
      await render(
        ["ImageGallery", "ImageCompare", "DocumentSearch", "PromptTemplate"]
          .map(sourceOf)
          .join("\n\n"),
        { hydrate: true }
      )
    );
    await page.getByRole("button", { name: "Before layout" }).click();
    await expect
      .poll(async () => await page.getByRole("dialog").isVisible())
      .toBe(true);
    await page.getByRole("button", { name: "Next image" }).click();
    await expect(
      page.getByRole("dialog").getByAltText("After layout").count()
    ).resolves.toBe(1);
    await page.keyboard.press("Escape");
    await expect
      .poll(async () => await page.getByRole("dialog").count())
      .toBe(0);
    await page.getByRole("slider").fill("75");
    await expect
      .poll(async () => await page.getByRole("slider").inputValue())
      .toBe("75");
    await page.getByLabel("Search text").fill("rendering instructions");
    await page
      .locator("[data-document-search]")
      .getByRole("link")
      .first()
      .click();
    await expect
      .poll(
        async () =>
          await page.evaluate(() => document.activeElement?.textContent)
      )
      .toContain("rendering instructions");
    await page.getByLabel("Topic", { exact: true }).fill("testing");
    await expect
      .poll(
        async () =>
          await page
            .getByRole("region", { name: "Prompt template" })
            .locator("pre")
            .textContent()
      )
      .toBe("Summarize testing in three sentences.");
    expect(errors).toStrictEqual([]);
  });
});

describe("native document media", () => {
  it("loads an actual PDF viewer and decodes local audio/video with captions", async () => {
    const html = await render(
      ["PdfPreview", "AudioTranscript", "Video"].map(sourceOf).join("\n\n"),
      { hydrate: true }
    );
    const assets = new Map<string, { body: Buffer; type: string }>();
    await Promise.all(
      [
        ["example.pdf", "application/pdf"],
        ["tone.wav", "audio/wav"],
        ["example.webm", "video/webm"],
        ["captions.vtt", "text/vtt"],
        ["before.svg", "image/svg+xml"],
      ].map(async ([name, type]) => {
        assets.set(`/assets/${name}`, {
          body: await readFile(path.resolve("examples/catalog/assets", name)),
          type,
        });
      })
    );
    const server = createServer((request, response) => {
      const asset = assets.get(request.url ?? "");
      if (asset) {
        response.writeHead(200, { "Content-Type": asset.type }).end(asset.body);
        return;
      }
      response
        .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        .end(html);
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({ channel: "chromium" });
      const address = server.address();
      if (address === null || typeof address === "string") {
        throw new Error("Missing test server address");
      }
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${address.port}`);
      await expect
        .poll(
          () =>
            page
              .frames()
              .some((frame) => frame.url().startsWith("chrome-extension://")),
          { timeout: 10_000 }
        )
        .toBe(true);
      expect(
        page.frames().some((frame) => frame.url().startsWith("chrome-error://"))
      ).toBeFalsy();
      await expect
        .poll(
          async () =>
            await page
              .locator("audio")
              .evaluate((element: HTMLAudioElement) => element.duration)
        )
        .toBe(1);
      await expect
        .poll(
          async () =>
            await page
              .locator("video")
              .evaluate((element: HTMLVideoElement) => element.duration)
        )
        .toBe(1);
      await expect(
        page.locator('track[kind="captions"]').count()
      ).resolves.toBe(2);
    } finally {
      await browser?.close();
      const closed = once(server, "close");
      server.close();
      await closed;
    }
  });
});

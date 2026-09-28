import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { render } from "../src/render.js";

const dirs: string[] = [];

const makeDir = async (): Promise<string> => {
  const dir = await mkdtemp(
    path.join(os.tmpdir(), "mdxr-include-link-browser-")
  );
  dirs.push(dir);
  return dir;
};

const watchErrors = (page: Page, errors: string[]): void => {
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  page.on("console", (message) => {
    if (
      /hydration|hydrating|Minified React error|Not allowed to load local resource/iu.test(
        message.text()
      )
    ) {
      errors.push(message.text());
    }
  });
};

describe("DocumentLink browser behavior", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map(async (dir) => {
        await rm(dir, { force: true, recursive: true });
      })
    );
  });

  afterAll(async () => {
    await browser?.close();
  });

  it.each([true, false])(
    "opens bundled nested documents from file:// with Enter (hydrate: %s)",
    async (hydrate) => {
      const dir = await makeDir();
      const childPath = path.join(dir, "child.mdx");
      const nestedPath = path.join(dir, "nested.md");
      const imagePath = path.join(dir, "child.png");
      const htmlPath = path.join(dir, "preview.html");
      const errors: string[] = [];

      await writeFile(
        path.join(dir, "mdxr.config.ts"),
        'export default { components: "./components.tsx", theme: "./theme.css" };\n'
      );
      await writeFile(
        path.join(dir, "components.tsx"),
        `import { defineComponent, v } from "@suzumiyaaoba/mdxr";
export const ProjectBadge = defineComponent(
  { schema: v.looseObject({ label: v.string() }) },
  ({ label }) => <strong className="project-badge" data-project-badge>{label}</strong>
);
`
      );
      await writeFile(
        path.join(dir, "theme.css"),
        ".project-badge { --linked-document-theme-marker: loaded; }\n"
      );
      await writeFile(
        imagePath,
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+c8L8AAAAASUVORK5CYII=",
          "base64"
        )
      );
      await writeFile(
        childPath,
        `# Child guide

<ProjectBadge label="Project component from child" />

![Bundled child image](child.png)

[Jump to target](#target-section)

          <DocumentLink path="nested.md" label="Open nested guide" />

<SyncedTabs syncKey="linked-child-tabs">
  <TabItem label="Overview">Overview panel.</TabItem>
  <TabItem label="Details">Hydrated child panel.</TabItem>
</SyncedTabs>

${Array.from({ length: 32 }, (_, index) => `Scroll filler paragraph ${index + 1}.`).join("\n\n")}

## Target section

Target reached.
`
      );
      await writeFile(nestedPath, "# Nested guide\n\nNested child content.\n");

      const html = await render(
        '<DocumentLink path="child.mdx" label="Open child guide" section="child-guide" />',
        { dir, filePath: "unsaved-root.mdx", hydrate }
      );
      await writeFile(htmlPath, html);
      // The HTML carries both child renders; it must not need the source files
      // after rendering, including when opened directly from file://.
      await rm(childPath);
      await rm(nestedPath);
      await rm(imagePath);

      const context = await browser.newContext({
        viewport: { height: 400, width: 1280 },
      });
      context.on("page", (page) => {
        watchErrors(page, errors);
      });
      try {
        const page = await context.newPage();
        await page.goto(pathToFileURL(htmlPath).href);
        const rootLink = page.locator("a[data-mdxr-document]");

        await rootLink.focus();
        const childPromise = page.waitForEvent("popup");
        await page.keyboard.press("Enter");
        const child = await childPromise;
        await child.waitForLoadState("load");
        const badge = child.locator("[data-project-badge]");
        const image = child.locator('img[alt="Bundled child image"]');
        const childSnapshot = {
          badgeText: await badge.textContent(),
          imageNaturalWidth: await image.evaluate((element) =>
            element instanceof HTMLImageElement ? element.naturalWidth : 0
          ),
          opensInNewTab: await rootLink.getAttribute("target"),
          themeMarker: await badge.evaluate((element) =>
            getComputedStyle(element)
              .getPropertyValue("--linked-document-theme-marker")
              .trim()
          ),
          url: child.url().startsWith("blob:"),
        };
        expect(childSnapshot).toStrictEqual({
          badgeText: "Project component from child",
          imageNaturalWidth: 1,
          opensInNewTab: "_blank",
          themeMarker: "loaded",
          url: true,
        });

        let hydrationBehavior = false;
        if (hydrate) {
          const detailsTab = child.getByRole("tab", { name: "Details" });
          await detailsTab.click();
          hydrationBehavior =
            (await detailsTab.getAttribute("aria-selected")) === "true";
        } else {
          hydrationBehavior =
            (await child.getByText("Overview panel.").count()) === 1 &&
            (await child.getByText("Hydrated child panel.").count()) === 1;
        }
        expect(hydrationBehavior).toBeTruthy();

        const [childDocumentUrl] = child.url().split("#", 1);

        const fragmentLink = child.getByRole("link", {
          name: "Jump to target",
        });
        const targetHeading = child.locator("#target-section");
        const targetTopBefore = await targetHeading.evaluate(
          (element) => element.getBoundingClientRect().top
        );
        const viewportHeight = await child.evaluate(() => window.innerHeight);
        const fragmentHref = await fragmentLink.getAttribute("href");
        await fragmentLink.click();
        await expect
          .poll(
            async () =>
              await targetHeading.evaluate((element) => {
                const bounds = element.getBoundingClientRect();
                return bounds.top < window.innerHeight && bounds.bottom > 0;
              })
          )
          .toBe(true);
        const targetTopAfter = await targetHeading.evaluate(
          (element) => element.getBoundingClientRect().top
        );
        const [currentChildDocumentUrl] = child.url().split("#", 1);
        const scrollTop = await child.evaluate(
          () => document.scrollingElement?.scrollTop ?? 0
        );
        expect({
          finalTop: targetTopAfter,
          fragmentHref,
          initialTop: targetTopBefore,
          sameDocument: currentChildDocumentUrl === childDocumentUrl,
          scrollTop,
          startedBelowViewport: targetTopBefore >= viewportHeight,
          targetInViewport:
            targetTopAfter >= 0 && targetTopAfter < viewportHeight,
          targetPresent: (await targetHeading.count()) === 1,
          viewportHeight,
        }).toStrictEqual({
          finalTop: targetTopAfter,
          fragmentHref: "#target-section",
          initialTop: targetTopBefore,
          sameDocument: true,
          scrollTop,
          startedBelowViewport: true,
          targetInViewport: true,
          targetPresent: true,
          viewportHeight,
        });

        const nestedLink = child.getByRole("link", {
          name: /Open nested guide/u,
        });
        await nestedLink.focus();
        const nestedPromise = child.waitForEvent("popup");
        await child.keyboard.press("Enter");
        const nested = await nestedPromise;
        await nested.waitForLoadState("load");
        expect({
          errors,
          hasContent:
            (await nested.getByText("Nested child content.").count()) === 1,
          isBlob: nested.url().startsWith("blob:"),
        }).toStrictEqual({
          errors: [],
          hasContent: true,
          isBlob: true,
        });
      } finally {
        await context.close();
      }
    }
  );
});

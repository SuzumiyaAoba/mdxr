import { chromium } from "playwright";
import { describe, expect, it } from "vitest";

import { render } from "../src/render.js";

const DOC = `# Title

Intro.

## First section

Text.

### Sub A

Text.

#### Too deep

Text.

## Second \`<section>\`

Text.
`;

const tocData = (html: string): unknown => {
  const raw =
    /<script type="application\/json" id="mdxr-page-toc-data">(?<json>[^<]*)<\/script>/u.exec(
      html
    )?.groups?.json;
  return raw === undefined ? undefined : JSON.parse(raw);
};

describe("page sidebar ToC", () => {
  it("lists h2–h3 headings and escapes the JSON island", async () => {
    const html = await render(DOC, { hydrate: false });
    expect(html).toContain('<aside id="mdxr-page-toc"');
    expect(html).not.toContain("Second <section>");
    expect(tocData(html)).toStrictEqual([
      { depth: 2, slug: "first-section", text: "First section" },
      { depth: 3, slug: "sub-a", text: "Sub A" },
      { depth: 2, slug: "second-section", text: "Second <section>" },
    ]);
    // Static output ships no ToC client code.
    expect(html).not.toContain("hydrateRoot");
  });

  it("skips pages with fewer than two entries or `toc: false`", async () => {
    const single = await render("# T\n\n## Only\n\nText.", { hydrate: false });
    expect(single).not.toContain('id="mdxr-page-toc"');
    const optedOut = await render(`---\ntoc: false\n---\n\n${DOC}`, {
      hydrate: false,
    });
    expect(optedOut).not.toContain('id="mdxr-page-toc"');
  });

  const filler = "\n\nLorem ipsum dolor sit amet.".repeat(40);

  // With `:::note` the document bundle mounts the sidebar; without any
  // catalog component the standalone ToC bundle does.
  it.each([
    ["standalone bundle", `## Alpha${filler}\n\n## Beta${filler}`],
    [
      "document bundle",
      `## Alpha${filler}\n\n:::note\nhi\n:::\n\n## Beta${filler}`,
    ],
  ])("hydrates via the %s and tracks the heading on screen", async (_, doc) => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        viewport: { height: 600, width: 1440 },
      });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => {
        if (m.type() === "error") {
          errors.push(m.text());
        }
      });
      await page.setContent(await render(doc));
      await page.locator("#beta").scrollIntoViewIfNeeded();
      await expect
        .poll(
          async () =>
            await page.$$eval("#mdxr-page-toc a[data-active=true]", (as) =>
              as.map((a) => a.textContent)
            )
        )
        .toStrictEqual(["Beta"]);
      expect(errors).toStrictEqual([]);
    } finally {
      await browser.close();
    }
  });
});

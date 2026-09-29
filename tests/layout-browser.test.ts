import { chromium } from "playwright";
import { describe, expect, it } from "vitest";

import { render } from "../src/render.js";

describe("responsive component layouts", () => {
  it("centers title badges in Plan and frontmatter headers", async () => {
    const browser = await chromium.launch();
    try {
      const documents = [
        ["Plan", '<Plan title="Renderer rewrite" status="doing" />'],
        [
          "frontmatter",
          "---\ntitle: Renderer rewrite\nstatus: doing\n---\n\nContent.",
        ],
      ] as const;

      const alignments = await Promise.all(
        documents.map(async ([, source]) => {
          const page = await browser.newPage();
          await page.setContent(await render(source, { hydrate: false }));
          const alignment = await page
            .locator("header h1")
            .evaluate((heading) => {
              const badge = heading.nextElementSibling;
              const icon = badge?.querySelector("svg");
              if (badge === null || icon === null || icon === undefined) {
                return null;
              }

              const headingBounds = heading.getBoundingClientRect();
              const badgeBounds = badge.getBoundingClientRect();
              const iconBounds = icon.getBoundingClientRect();
              return {
                badgeCenter: badgeBounds.top + badgeBounds.height / 2,
                headingCenter: headingBounds.top + headingBounds.height / 2,
                iconCenter: iconBounds.top + iconBounds.height / 2,
                titleFontSize: getComputedStyle(heading).fontSize,
              };
            });
          return alignment;
        })
      );

      for (const alignment of alignments) {
        expect(alignment).not.toBeNull();
        if (alignment === null) {
          continue;
        }

        expect(
          Math.abs(alignment.headingCenter - alignment.badgeCenter)
        ).toBeLessThan(1);
        expect(
          Math.abs(alignment.badgeCenter - alignment.iconCenter)
        ).toBeLessThan(1);
        expect(alignment.titleFontSize).toBe("36px");
      }
    } finally {
      await browser.close();
    }
  });

  it("keeps wide matrix columns and API tables reachable on mobile", async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        viewport: { height: 844, width: 390 },
      });
      await page.setContent(
        await render(
          `<Matrix cols="Alpha, Beta, Gamma, Delta">

- Feature | yes | no | partial | Available

</Matrix>

<Props of="Wide API"><Prop name="longPropertyName" type="Promise&lt;SomeComplexReturnType&gt;" default="undefined">Detailed description</Prop></Props>`,
          { hydrate: false }
        )
      );
      await Promise.all(
        ["Delta", "Detailed description"].map(async (label) => {
          const reachable = await page
            .getByText(label, { exact: true })
            .evaluate((element) => {
              const bounds = element.getBoundingClientRect();
              for (
                let parent = element.parentElement;
                parent !== null;
                parent = parent.parentElement
              ) {
                const overflow = getComputedStyle(parent).overflowX;
                const clip = parent.getBoundingClientRect();
                if (
                  ["hidden", "clip", "auto", "scroll"].includes(overflow) &&
                  (bounds.right > clip.right + 1 || bounds.left < clip.left - 1)
                ) {
                  return (
                    ["auto", "scroll"].includes(overflow) &&
                    parent.scrollWidth > parent.clientWidth
                  );
                }
              }
              return bounds.right <= innerWidth;
            });
          expect({ label, reachable }).toStrictEqual({
            label,
            reachable: true,
          });
        })
      );
    } finally {
      await browser.close();
    }
  });

  it("keeps long source paths inside horizontal scroll boxes", async () => {
    const browser = await chromium.launch();
    try {
      // Neither of these paths has a Chromium line-break opportunity ("/" is
      // not one), so they overflow unless rendered as scroll boxes.
      const longPath =
        "src/components/deeply/nested/directory/structure/with/a/very/long/file/path/component-name.tsx";
      // A real file — remarkFilePaths converts the inline-code mention into
      // a FileRef chip.
      const realPath = "src/ui/wireframe-library-menubar.tsx";
      const page = await browser.newPage({
        viewport: { height: 844, width: 390 },
      });
      await page.setContent(
        await render(
          `# Path overflow

Inline code \`${longPath}\` and a real file \`${realPath}\` mention.

<FileRef path="${longPath}" />

<Trace><TraceFrame name="deepCall" path="${longPath}" lines="12-40">note</TraceFrame></Trace>

<Files><File path="${longPath}" kind="modify">changed file</File></Files>

<Cmd>pnpm dlx tool --output ${longPath}</Cmd>

<SymbolRef name="renderDeepTree" path="${longPath}" />

<Endpoints><Endpoint method="GET" path="/api/v1/${longPath}/items" auth="required" /></Endpoints>

\`\`\`ts title="${longPath}"
const x = 1;
\`\`\`
`,
          { hydrate: false }
        )
      );
      const report = await page.evaluate(() => {
        const { clientWidth, scrollWidth } = document.documentElement;
        const elements = [...document.querySelectorAll("main *")].filter(
          (el) => el instanceof HTMLElement
        );
        return {
          docOverflow: scrollWidth - clientWidth,
          exposed: elements.filter((el) => {
            // An ancestor with a clipping overflowX caps what can reach the
            // screen — fold every clip ancestor's edge into the painted
            // right edge, not just the element's own box.
            let { right } = el.getBoundingClientRect();
            for (
              let parent = el.parentElement;
              parent !== null;
              parent = parent.parentElement
            ) {
              const overflow = getComputedStyle(parent).overflowX;
              if (["hidden", "clip", "auto", "scroll"].includes(overflow)) {
                right = Math.min(right, parent.getBoundingClientRect().right);
              }
            }
            return right > clientWidth + 1;
          }).length,
          scrollers: elements.filter(
            (el) => el.scrollWidth - el.clientWidth > 10
          ).length,
        };
      });
      // No element may paint past the viewport, and the path-bearing
      // surfaces (inline code, chips, loc links, file rows, code header)
      // must scroll horizontally.
      expect(report.docOverflow).toBe(0);
      expect(report.exposed).toBe(0);
      expect(report.scrollers).toBeGreaterThanOrEqual(6);
    } finally {
      await browser.close();
    }
  });

  it("aligns Files columns and scrolls long row content inside its table", async () => {
    const browser = await chromium.launch();
    try {
      const title = "Files overflow regression";
      const longPath =
        "src/components/deeply/nested/directory/structure/with/a/very/long/component-name-that-keeps-going.tsx";
      const longKind =
        "integration-investigation-with-a-deliberately-long-kind-label";
      const longDescription =
        "This description has many words and continues far past the viewport so readers can scroll to its final phrase.";
      const page = await browser.newPage({
        viewport: { height: 844, width: 390 },
      });
      await page.setContent(
        await render(
          `<Files title="${title}"><File path="${longPath}" kind="${longKind}">${longDescription}</File><File path="README.md">This row has a description but intentionally leaves its kind empty.</File><File path="package.json" kind="config" /></Files>`,
          { hydrate: false }
        )
      );

      const filesRegion = page.getByRole("region", { name: title });
      const report = await filesRegion.evaluate((region) => {
        if (!(region instanceof HTMLElement)) {
          return null;
        }

        const table = region.querySelector("table");
        if (!(table instanceof HTMLTableElement)) {
          return null;
        }

        const headers = [
          ...table.querySelectorAll<HTMLTableCellElement>("thead th"),
        ];
        const rows = [
          ...table.querySelectorAll<HTMLTableRowElement>("tbody tr"),
        ];
        if (headers.length !== 3 || rows.length !== 3) {
          return null;
        }

        const cells = rows.map((row) => [...row.cells]);
        const [firstRow = [], secondRow = [], thirdRow = []] = cells;
        const alignedColumns = cells.every(
          (row) =>
            row.length === headers.length &&
            row.every((cell, index) => {
              const header = headers[index];
              return (
                header !== undefined &&
                Math.abs(
                  cell.getBoundingClientRect().left -
                    header.getBoundingClientRect().left
                ) < 1
              );
            })
        );
        const longTextNodes = firstRow.map((element) =>
          document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode()
        );
        const longTextLineCounts = longTextNodes.map((textNode) => {
          if (textNode === null) {
            return 0;
          }
          const range = document.createRange();
          range.selectNodeContents(textNode);
          return range.getClientRects().length;
        });
        const longTextEndsReachable = longTextNodes.map((textNode) => {
          if (textNode === null) {
            return false;
          }
          const range = document.createRange();
          range.selectNodeContents(textNode);
          const scrollerBounds = region.getBoundingClientRect();
          const initialBounds = range.getBoundingClientRect();
          const maxScrollLeft = Math.max(
            0,
            region.scrollWidth - region.clientWidth
          );
          region.scrollLeft = Math.min(
            maxScrollLeft,
            Math.max(
              region.scrollLeft,
              region.scrollLeft + initialBounds.right - scrollerBounds.right + 1
            )
          );
          const finalRight = range.getBoundingClientRect().right;
          return finalRight <= region.getBoundingClientRect().right + 1;
        });
        const documentWidth = document.documentElement;

        return {
          alignedColumns,
          documentOverflow:
            documentWidth.scrollWidth - documentWidth.clientWidth,
          emptyDescriptionCell: thirdRow[2]?.textContent?.trim() === "",
          emptyKind: secondRow[1]?.textContent?.trim() === "",
          hasHorizontalOverflow: region.scrollWidth > region.clientWidth,
          longTextEndsReachable,
          longTextLineCounts,
        };
      });

      expect(report).toStrictEqual({
        alignedColumns: true,
        documentOverflow: 0,
        emptyDescriptionCell: true,
        emptyKind: true,
        hasHorizontalOverflow: true,
        longTextEndsReachable: [true, true, true],
        longTextLineCounts: [1, 1, 1],
      });

      await filesRegion.evaluate((region) => {
        region.scrollLeft = 0;
      });
      await filesRegion.focus();
      await filesRegion.press("ArrowRight");
      await expect
        .poll(async () => {
          const scrollLeft = await filesRegion.evaluate(
            (region) => region.scrollLeft
          );
          return scrollLeft;
        })
        .toBeGreaterThan(0);
    } finally {
      await browser.close();
    }
  });
});

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
});

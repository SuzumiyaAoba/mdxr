import { chromium } from "playwright";
import { describe, expect, it } from "vitest";

import { render } from "../src/render.js";

describe("responsive component layouts", () => {
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

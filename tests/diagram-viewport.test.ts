import { chromium } from "playwright";
import type { Browser, Locator } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MERMAID_CDN_URL } from "../src/assets/scripts.js";
import { render } from "../src/render.js";

const GRAPH = `<Graph title="Runtime" direction="right" minScale="0.5">
  <Node id="ui" label="Application interface" href="#destination" />
  <Node id="core" label="Execution core" />
  <Edge from="ui" to="core" />
</Graph>`;

const ARCHITECTURE = `<Architecture title="Services" nodes='[{"id":"ui","label":"Application"},{"id":"api","label":"API"}]' edges='[{"from":"ui","to":"api"}]' />`;

const geometry = async (image: Locator) => {
  const box = await image.boundingBox();
  if (box === null) {
    throw new Error("Diagram image is not visible");
  }
  return box;
};

const dataValue = async (
  locator: Locator,
  key: string
): Promise<string | null> =>
  await locator.evaluate(
    (element, dataKey) =>
      element instanceof HTMLElement
        ? (element.dataset[dataKey] ?? null)
        : null,
    key
  );

describe("diagram navigation", () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
  });

  it.each([false, true])(
    "zooms, pans and resets independent diagrams (hydrate: %s)",
    async (hydrate) => {
      // oxlint-disable vitest/max-expects -- Each assertion checks a distinct stage of the combined zoom, pan, and reset scenario.
      const page = await browser.newPage({
        viewport: { height: 900, width: 900 },
      });
      const errors: string[] = [];
      page.on("pageerror", (error) => {
        errors.push(error.message);
      });
      page.on("console", (message) => {
        if (/hydration|hydrating|Minified React error/iu.test(message.text())) {
          errors.push(message.text());
        }
      });
      try {
        await page.setContent(
          await render(`${GRAPH}\n\n${ARCHITECTURE}`, { hydrate })
        );
        const graph = page.locator("[data-mdxr-diagram]").first();
        const canvas = graph.locator(".mdxr-diagram-canvas");
        const image = canvas.locator(":scope > svg");
        const original = await geometry(image);
        await graph
          .getByRole("button", { exact: true, name: "Zoom in" })
          .click();
        const zoomedIn = await geometry(image);
        expect(zoomedIn.width).toBeCloseTo(original.width * 1.25);
        await expect(graph.locator("output").textContent()).resolves.toBe(
          "125%"
        );
        const second = page.locator("[data-mdxr-diagram]").nth(1);
        await expect(second.locator("output").textContent()).resolves.toBe(
          "100%"
        );
        await second
          .getByRole("button", { exact: true, name: "Zoom in" })
          .click();
        await expect(second.locator("output").textContent()).resolves.toBe(
          "125%"
        );

        await graph
          .getByRole("button", { exact: true, name: "Zoom out" })
          .click();
        const zoomedOut = await geometry(image);
        expect(zoomedOut.width).toBeCloseTo(original.width);
        await canvas.focus();
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowDown");
        const panned = await geometry(image);
        expect(panned.x).toBeCloseTo(original.x - 40);
        expect(panned.y).toBeCloseTo(original.y - 40);
        await page.keyboard.press("+");
        const keyboardZoomed = await geometry(image);
        expect(keyboardZoomed.width).toBeCloseTo(original.width * 1.25);
        await page.keyboard.press("0");
        await expect(geometry(image)).resolves.toStrictEqual(original);
        expect(errors).toStrictEqual([]);
      } finally {
        await page.close();
      }
      // oxlint-enable vitest/max-expects
    }
  );

  it("drags linked nodes without following them, while preserving ordinary clicks", async () => {
    // oxlint-disable vitest/max-expects -- These assertions preserve the ordered drag, click, and reset interaction checks.
    const page = await browser.newPage();
    try {
      await page.setContent(await render(GRAPH));
      const canvas = page.locator(".mdxr-diagram-canvas");
      const image = canvas.locator(":scope > svg");
      const link = page.getByRole("link", { name: "Application interface" });
      await link.evaluate((element) => {
        element.addEventListener("click", (event) => {
          event.preventDefault();
          document.body.dataset.linkClicks = String(
            Number(document.body.dataset.linkClicks ?? 0) + 1
          );
        });
      });
      const original = await geometry(image);
      const bounds = await geometry(link);
      await page.mouse.move(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        bounds.x + bounds.width / 2 + 50,
        bounds.y + bounds.height / 2 + 35,
        { steps: 5 }
      );
      await page.mouse.up();
      const moved = await geometry(image);
      expect(moved.x).toBeCloseTo(original.x + 50);
      expect(moved.y).toBeCloseTo(original.y + 35);
      await expect(
        dataValue(page.locator("body"), "linkClicks")
      ).resolves.toBeNull();
      await expect(dataValue(canvas, "dragging")).resolves.toBeNull();
      // A toolbar click immediately after a drag must not be mistaken for its trailing click.
      await page.getByRole("button", { name: "Reset view" }).click();
      await expect(geometry(image)).resolves.toStrictEqual(original);
      await link.click();
      await expect(dataValue(page.locator("body"), "linkClicks")).resolves.toBe(
        "1"
      );
      await page.getByRole("button", { name: "Reset view" }).click();
      await expect(geometry(image)).resolves.toStrictEqual(original);
    } finally {
      await page.close();
    }
    // oxlint-enable vitest/max-expects
  });

  it("keeps ordinary scrolling and zooms around the pointer within bounded scales", async () => {
    // oxlint-disable vitest/max-expects -- Each assertion checks wheel behavior and both scale limits in sequence.
    const page = await browser.newPage();
    try {
      await page.setContent(await render(GRAPH, { hydrate: false }));
      const canvas = page.locator(".mdxr-diagram-canvas");
      const image = canvas.locator(":scope > svg");
      const original = await geometry(image);
      const point = {
        x: original.x + original.width / 3,
        y: original.y + original.height / 3,
      };
      const wheel = async (ctrlKey: boolean, deltaY: number) =>
        await canvas.evaluate(
          (element, params) => {
            const event = new WheelEvent("wheel", {
              bubbles: true,
              cancelable: true,
              clientX: params.x,
              clientY: params.y,
              ctrlKey: params.ctrlKey,
              deltaY: params.deltaY,
            });
            element.dispatchEvent(event);
            return event.defaultPrevented;
          },
          { ...point, ctrlKey, deltaY }
        );
      await expect(wheel(false, -50)).resolves.toBeFalsy();
      await expect(geometry(image)).resolves.toStrictEqual(original);
      await expect(wheel(true, -50)).resolves.toBeTruthy();
      const zoomed = await geometry(image);
      expect(zoomed.width).toBeGreaterThan(original.width);
      expect((point.x - zoomed.x) / zoomed.width).toBeCloseTo(1 / 3);
      expect((point.y - zoomed.y) / zoomed.height).toBeCloseTo(1 / 3);
      for (let i = 0; i < 6; i += 1) {
        // oxlint-disable-next-line no-await-in-loop -- Wheel gestures must run one at a time to exercise the bounded scale.
        await wheel(true, -100);
      }
      await expect(page.locator("output").textContent()).resolves.toBe("400%");
      await expect(
        page.getByRole("button", { exact: true, name: "Zoom in" }).isDisabled()
      ).resolves.toBeTruthy();
      for (let i = 0; i < 6; i += 1) {
        // oxlint-disable-next-line no-await-in-loop -- Wheel gestures must run one at a time to exercise the bounded scale.
        await wheel(true, 100);
      }
      await expect(page.locator("output").textContent()).resolves.toBe("25%");
      await expect(
        page.getByRole("button", { exact: true, name: "Zoom out" }).isDisabled()
      ).resolves.toBeTruthy();
    } finally {
      await page.close();
    }
    // oxlint-enable vitest/max-expects
  });

  it("supports touch pan and pinch, and restores an unclipped diagram for printing", async () => {
    // oxlint-disable vitest/max-expects -- This scenario verifies each touch gesture and its print-state cleanup.
    const page = await browser.newPage({
      hasTouch: true,
      viewport: { height: 844, width: 390 },
    });
    try {
      await page.setContent(await render(GRAPH, { hydrate: false }));
      const canvas = page.locator(".mdxr-diagram-canvas");
      const image = canvas.locator(":scope > svg");
      const original = await geometry(image);
      const bounds = await geometry(canvas);
      const session = await page.context().newCDPSession(page);
      const x = bounds.x + 120;
      const y = bounds.y + 70;
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [{ id: 1, x, y }],
        type: "touchStart",
      });
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [{ id: 1, x: x + 20, y: y + 20 }],
        type: "touchMove",
      });
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [],
        type: "touchEnd",
      });
      const panned = await geometry(image);
      expect(panned.x).toBeCloseTo(original.x + 20);
      expect(panned.y).toBeCloseTo(original.y + 20);
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [
          { id: 1, x: x - 30, y },
          { id: 2, x: x + 30, y },
        ],
        type: "touchStart",
      });
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [
          { id: 1, x: x - 60, y },
          { id: 2, x: x + 60, y },
        ],
        type: "touchMove",
      });
      await session.send("Input.dispatchTouchEvent", {
        touchPoints: [],
        type: "touchCancel",
      });
      const pinched = await geometry(image);
      expect(pinched.width).toBeCloseTo(original.width * 2);
      await expect(dataValue(canvas, "dragging")).resolves.toBeNull();
      await expect(
        page.evaluate(() => document.documentElement.scrollWidth)
      ).resolves.toBe(390);
      await page.emulateMedia({ media: "print" });
      await expect(
        page.getByRole("button", { exact: true, name: "Zoom in" }).isVisible()
      ).resolves.toBeFalsy();
      await expect(
        image.evaluate((element) => getComputedStyle(element).transform)
      ).resolves.toBe("none");
      const printed = await geometry(image);
      expect(printed.width).toBeLessThan(390);
      expect(printed.x).toBeGreaterThanOrEqual(0);
    } finally {
      await page.close();
    }
    // oxlint-enable vitest/max-expects
  });

  it("enhances Mermaid after its asynchronous renderer inserts an SVG", async () => {
    // oxlint-disable vitest/max-expects -- The assertions verify Mermaid enhancement, zoom, and reset as one flow.
    const page = await browser.newPage();
    try {
      // Isolate navigation from the CDN: reproduce Mermaid's asynchronous DOM replacement.
      await page.route(MERMAID_CDN_URL, async (route) => {
        await route.fulfill({
          body: `export default {
            initialize() {},
            async run({ nodes }) {
              await new Promise(resolve => requestAnimationFrame(resolve));
              for (const node of nodes) {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('viewBox', '0 0 600 200');
                svg.setAttribute('width', '600');
                svg.setAttribute('height', '200');
                node.replaceChildren(svg);
              }
            }
          };`,
          contentType: "text/javascript",
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      });
      await page.setContent(
        await render("```mermaid\ngraph TD\nA-->B\n```", { hydrate: false })
      );
      const image = page.locator(".mermaid > svg");
      await image.waitFor();
      const original = await geometry(image);
      await page.getByRole("button", { exact: true, name: "Zoom in" }).click();
      const zoomed = await geometry(image);
      expect(zoomed.width).toBeCloseTo(original.width * 1.25);
      await page.getByRole("button", { name: "Reset view" }).click();
      await expect(geometry(image)).resolves.toStrictEqual(original);
    } finally {
      await page.close();
    }
    // oxlint-enable vitest/max-expects
  });
});

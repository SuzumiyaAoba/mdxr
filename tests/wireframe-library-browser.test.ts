import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
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
import examples from "./fixtures/wireframe-catalog.json";

const sourceFor = (family: string): string =>
  examples.find((example) => example.family === family)?.source ?? "";

describe("wireframe-ui browser coverage", () => {
  let browser: Browser;
  let page: Page;
  let errors: string[];
  beforeAll(async () => {
    browser = await chromium.launch();
  });
  beforeEach(async () => {
    page = await browser.newPage({ viewport: { height: 900, width: 1000 } });
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

  const open = async (source: string) => {
    await page.setContent(
      await render(
        `${source}\n\n<WireframeSwitch aria-label="Hydration check" />`
      )
    );
    const ready = page.getByRole("switch", {
      exact: true,
      name: "Hydration check",
    });
    await ready.click();
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLElement>('[aria-label="Hydration check"]')
          ?.dataset.state === "checked"
    );
  };

  it.each(examples)(
    "hydrates $kind: $family without server/client differences",
    async ({ source }) => {
      await open(source);
      expect(errors).toStrictEqual([]);
    }
  );

  it.each(["dialog", "drawer", "sheet"])(
    "opens, focuses, and dismisses %s",
    async (family) => {
      await open(sourceFor(family));
      await page
        .getByRole("button", { exact: true, name: `Open ${family}` })
        .click();
      await expect
        .poll(async () => await page.getByRole("dialog").isVisible())
        .toBe(true);
      await page.getByRole("button", { exact: true, name: "Done" }).click();
      await expect
        .poll(async () => await page.getByRole("dialog").count())
        .toBe(0);
      expect(errors).toStrictEqual([]);
    }
  );

  it("selects an option, changes tabs, toggles controls, and moves a slider by keyboard", async () => {
    await open(
      ["select", "tabs", "checkbox", "toggle", "slider"]
        .map(sourceFor)
        .join("\n\n")
    );
    await page.getByRole("combobox", { name: "Plan" }).click();
    await page.getByRole("option", { exact: true, name: "Team" }).click();
    await expect(
      page.getByRole("combobox", { name: "Plan" }).textContent()
    ).resolves.toContain("Team");
    await page.getByRole("tab", { exact: true, name: "Notes" }).click();
    await expect(
      page.getByText("Review notes", { exact: true }).isVisible()
    ).resolves.toBeTruthy();
    await page.getByRole("checkbox", { name: "Consent" }).click();
    await page.getByRole("button", { name: "Favorite" }).click();
    expect({
      checked: await page
        .getByRole("checkbox", { name: "Consent" })
        .isChecked(),
      pressed: await page
        .getByRole("button", { name: "Favorite" })
        .getAttribute("aria-pressed"),
    }).toStrictEqual({ checked: false, pressed: "false" });
    await page.getByRole("slider").focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("slider").getAttribute("aria-valuenow")
    ).resolves.toBe("35");
    expect(errors).toStrictEqual([]);
  });

  it("edits a declarative form and shows a toast", async () => {
    const form = sourceFor("form")
      .replace("<WireframeForm ", '<WireframeForm mode="onChange" ')
      .replace(
        '<WireframeFormField name="email">',
        `<WireframeFormField name="email" rules='{"required":"Email is required"}'>`
      );
    await open(`${form}\n\n${sourceFor("sonner")}`);
    const input = page.getByLabel("Form email", { exact: true });
    await expect(input.inputValue()).resolves.toBe("draft@example.com");
    await input.fill("review@example.com");
    await expect(input.inputValue()).resolves.toBe("review@example.com");
    await page
      .getByRole("button", { exact: true, name: "Button placeholder" })
      .click();
    await expect
      .poll(async () => await page.locator("[data-sonner-toast]").count())
      .toBe(1);
    await input.fill("");
    await expect
      .poll(
        async () =>
          await page.getByText("Email is required", { exact: true }).isVisible()
      )
      .toBe(true);
    expect(errors).toStrictEqual([]);
  });

  it("shows a composed placeholder in an unselected Select", async () => {
    await open(
      '<WireframeSelect><WireframeSelectTrigger aria-label="Subject"><WireframeSelectValue><WireframeText width="md" /></WireframeSelectValue></WireframeSelectTrigger><WireframeSelectContent><WireframeSelectItem value="support">Support</WireframeSelectItem></WireframeSelectContent></WireframeSelect>'
    );
    const placeholder = page
      .getByRole("combobox", { name: "Subject" })
      .locator('[data-slot="wireframe-text"]');
    await expect(placeholder.isVisible()).resolves.toBeTruthy();
    await expect(
      placeholder.evaluate((element) => element.getBoundingClientRect().width)
    ).resolves.toBe(128);
    expect(errors).toStrictEqual([]);
  });

  it("preserves public React callbacks, form render props, helpers, and real chart composition", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "mdxr-wireframe-project-")
    );
    try {
      await writeFile(
        path.join(directory, "mdxr.config.ts"),
        'export default { components: "./components.tsx" };'
      );
      await writeFile(
        path.join(directory, "components.tsx"),
        `
import { Bar, BarChart } from "recharts";
import { WireframeForm, WireframeFormField, WireframeFormItem, WireframeFormLabel, WireframeFormControl, WireframeInput, WireframeButton, WireframeChartContainer, WireframeChartTooltip, WireframeChartTooltipContent, WireframeChartLegend, WireframeChartLegendContent, WireframeToaster, useWireframeForm, wireframeToast } from "@suzumiyaaoba/mdxr/components";
export function ProjectDemo() {
  const form = useWireframeForm({ defaultValues: { name: "First draft" } });
  return <><WireframeForm {...form}><WireframeFormField control={form.control} name="name" render={({ field }) => <WireframeFormItem><WireframeFormLabel>Project name</WireframeFormLabel><WireframeFormControl><WireframeInput {...field} variant="default" /></WireframeFormControl></WireframeFormItem>} /></WireframeForm>
    <WireframeButton onClick={() => form.reset({ name: "Reset draft" })}>Reset form</WireframeButton>
    <WireframeChartContainer config={{ visits: { label: "Visits", color: "#777" } }}><BarChart data={[{ name: "A", visits: 12 }, { name: "B", visits: 20 }]}><Bar dataKey="visits" isAnimationActive={false} /><WireframeChartTooltip content={<WireframeChartTooltipContent />} /><WireframeChartLegend content={<WireframeChartLegendContent />} /></BarChart></WireframeChartContainer>
    <WireframeToaster /><WireframeButton onClick={() => wireframeToast("Draft saved")}>Save draft</WireframeButton><WireframeButton href="#draft" onClick={(event) => { event.preventDefault(); wireframeToast("Link clicked"); }}>Save link</WireframeButton></>;
}
`
      );
      await page.setContent(
        await render("<ProjectDemo />", { dir: directory })
      );
      const input = page.getByLabel("Project name", { exact: true });
      await input.fill("Edited draft");
      await page
        .getByRole("button", { exact: true, name: "Reset form" })
        .click();
      await expect
        .poll(async () => await input.inputValue())
        .toBe("Reset draft");
      await expect
        .poll(async () => await page.locator(".recharts-bar-rectangle").count())
        .toBe(2);
      await page
        .getByRole("button", { exact: true, name: "Save draft" })
        .click();
      await expect
        .poll(
          async () =>
            await page.getByText("Draft saved", { exact: true }).isVisible()
        )
        .toBe(true);
      await page.getByRole("link", { exact: true, name: "Save link" }).click();
      await expect
        .poll(
          async () =>
            await page.getByText("Link clicked", { exact: true }).isVisible()
        )
        .toBe(true);
      expect(errors).toStrictEqual([]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("generates real responsive text utilities and supports reduced motion", async () => {
    await open(
      `<WireframeText id="responsive-text" responsive='{"base":{"width":"xs"},"md":{"width":"lg","size":"xl"}}' /><WireframeText id="animated" animate="shimmer" />`
    );
    const dimensions = async () =>
      await page.locator("#responsive-text").evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        width: element.getBoundingClientRect().width,
      }));
    await expect(dimensions()).resolves.toStrictEqual({
      height: 20,
      width: 192,
    });
    await page.setViewportSize({ height: 844, width: 390 });
    await expect(dimensions()).resolves.toStrictEqual({
      height: 14,
      width: 64,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(
      page
        .locator("#animated")
        .evaluate((element) => getComputedStyle(element).animationName)
    ).resolves.toBe("none");
    expect(errors).toStrictEqual([]);
  });

  it("fits card headers and icons in the document column without clipping the pricing badge", async () => {
    await page.setViewportSize({ height: 1400, width: 1100 });
    await open(`${sourceFor("pricing")}\n\n${sourceFor("dashboard")}`);
    const headersFit = await page
      .locator('[data-slot="wireframe-card-header"]')
      .evaluateAll((elements) =>
        elements.every(
          (element) => element.scrollWidth <= element.clientWidth + 1
        )
      );
    expect(headersFit).toBeTruthy();
    const widths = await page
      .locator(
        '[data-wireframe-block="dashboard"] [data-slot="wireframe-card-header"] svg'
      )
      .evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().width)
      );
    expect(widths).toStrictEqual([24, 24, 24, 24]);
    const featured = page
      .locator('[data-wireframe-block="pricing"] [data-slot="wireframe-card"]')
      .filter({ has: page.locator(".absolute") });
    await expect(
      featured.evaluate((element) => getComputedStyle(element).overflow)
    ).resolves.toBe("visible");
    expect(errors).toStrictEqual([]);
  });

  it("loads media sources, shows an error placeholder, and gives repeated blocks unique IDs", async () => {
    await page.route("https://wireframe.test/image.svg", async (route) => {
      await route.fulfill({
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="gray"/></svg>',
        contentType: "image/svg+xml",
      });
    });
    await page.route("https://wireframe.test/missing.svg", async (route) => {
      await route.fulfill({ status: 404 });
    });
    await open(
      '<WireframeMedia src="https://wireframe.test/image.svg" alt="Loaded preview" /><WireframeMedia src="https://wireframe.test/missing.svg" label="Missing preview" /><WireframeLoginForm /><WireframeLoginForm />'
    );
    await expect
      .poll(
        async () =>
          await page
            .getByAltText("Loaded preview")
            .evaluate((element: HTMLImageElement) => element.naturalWidth)
      )
      .toBe(64);
    await expect
      .poll(
        async () =>
          await page
            .getByRole("img", { name: "Missing preview" })
            .getAttribute("data-slot")
      )
      .toBe("wireframe-media");
    const ids = await page
      .locator("[data-wireframe-block] [id]")
      .evaluateAll((elements) => elements.map((element) => element.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(errors).toStrictEqual([]);
  });
});

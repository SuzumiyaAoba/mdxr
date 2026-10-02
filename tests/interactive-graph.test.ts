import { chromium } from "playwright";
import { describe, expect, it } from "vitest";

import { mdxToAscii } from "../src/ascii/index.js";
import { render } from "../src/render.js";
import { renderDoc } from "./helpers.js";

const GRAPH = `<InteractiveGraph title="Document system" height="400" minimap="false">
  <GraphGroup id="application" label="Application">
    <Node id="api" label="API" note="Document requests" href="https://example.com/api">Accepts document changes.</Node>
    <Node id="worker" label="Worker">Publishes live updates.</Node>
  </GraphGroup>
  <Node id="database" label="Database">Persists documents.</Node>
  <Edge id="save" from="api" to="database" label="save" />
  <Edge id="publish" from="api" to="worker" label="publish" />
  <GraphView id="write" label="Write" edges="save">Save a document.</GraphView>
  <GraphView id="live" label="Live" nodes="api worker">Publish changes.</GraphView>
</InteractiveGraph>`;

describe("InteractiveGraph", () => {
  it("renders grouped nodes and connected edges without JavaScript", async () => {
    const { body } = await renderDoc(GRAPH);
    expect(body).toContain("react-flow__edge-path");
    expect(body).toContain("doc-graph-group-card");
    expect(body).toContain("Accepts document changes.");
    expect(body).toContain("https://example.com/api");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ javaScriptEnabled: false });
      await page.setContent(await render(GRAPH, { hydrate: false }));
      await expect(
        page.getByRole("button", { exact: true, name: "API" }).isVisible()
      ).resolves.toBeTruthy();
      await expect(
        page.locator(".react-flow__edge-path").count()
      ).resolves.toBe(2);
      await page.getByTitle("図のテキスト表示", { exact: true }).click();
      await expect(
        page.getByText("Persists documents.").isVisible()
      ).resolves.toBeTruthy();
    } finally {
      await browser.close();
    }
  });

  it.each([
    ['<Node id="a" /><Node id="a" />', "duplicate node"],
    [
      '<Node id="a" /><Edge from="a" to="missing" />',
      'unknown node ID "missing"',
    ],
    [
      '<Node id="a" /><GraphView id="v" nodes="missing" />',
      'unknown view node ID "missing"',
    ],
    [
      '<Node id="a" /><GraphView id="v" edges="missing" />',
      'unknown view edge ID "missing"',
    ],
    ['<GraphView id="all" />', 'view ID "all" is reserved'],
    [
      '<GraphGroup id="outer"><GraphGroup id="inner"><Node id="a" /></GraphGroup></GraphGroup>',
      "nested GraphGroup",
    ],
    ['<GraphGroup id="a"><Node id="a" /></GraphGroup>', "duplicate node/group"],
  ])("rejects invalid graph references: %s", async (children, message) => {
    await expect(
      renderDoc(`<InteractiveGraph>${children}</InteractiveGraph>`)
    ).rejects.toThrow(message);
  });

  it("validates the initial view and canvas height", async () => {
    await expect(
      renderDoc(GRAPH.replace('height="400"', 'defaultView="missing"'))
    ).rejects.toThrow("unknown defaultView");
    await expect(
      renderDoc(GRAPH.replace('height="400"', 'height="Infinity"'))
    ).rejects.toThrow("Invalid props");
  });

  it("preserves group labels, descriptions and connections in text output", async () => {
    const { markdown, warnings } = await mdxToAscii(GRAPH);
    expect(warnings).toStrictEqual([]);
    expect(markdown).toContain("Application");
    expect(markdown).toContain("Accepts document changes.");
    expect(markdown).toContain("`api` → `database`");
    expect(markdown).toContain("Save a document.");
  });

  it("keeps authored line and arrowhead colors across offline view changes", async () => {
    const source = GRAPH.replace(
      "<InteractiveGraph ",
      '<InteractiveGraph edgeColor="#64748b" '
    ).replace('<Edge id="save"', '<Edge color="#0d9488" id="save"');
    const html = await render(source);
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("https://**", async (route) => {
        await route.abort();
      });
      await page.setContent(html);
      const edgeColors = async () =>
        await page.locator(".react-flow__edge-path").evaluateAll((paths) =>
          paths.map((path) => {
            const markerUrl = path.getAttribute("marker-end") ?? "";
            const markerId = markerUrl.slice(
              markerUrl.indexOf("#") + 1,
              markerUrl.lastIndexOf("'")
            );
            const arrow = document
              .querySelector(`#${CSS.escape(markerId)}`)
              ?.querySelector("polyline");
            return {
              arrow:
                arrow === undefined || arrow === null
                  ? undefined
                  : getComputedStyle(arrow).fill,
              line: getComputedStyle(path).stroke,
            };
          })
        );
      const expected = [
        { arrow: "rgb(13, 148, 136)", line: "rgb(13, 148, 136)" },
        { arrow: "rgb(100, 116, 139)", line: "rgb(100, 116, 139)" },
      ];
      await expect(edgeColors()).resolves.toStrictEqual(expected);
      const views = page.getByRole("tablist", { name: "表示する経路" });
      await views.getByRole("tab", { name: "Write" }).click();
      await page.waitForFunction(
        () => document.querySelectorAll(".doc-graph-edge-dimmed").length === 1
      );
      await expect(edgeColors()).resolves.toStrictEqual(expected);
      await views.getByRole("tab", { name: "全体" }).click();
      await page.waitForFunction(
        () => document.querySelector(".doc-graph-edge-dimmed") === null
      );
      await expect(edgeColors()).resolves.toStrictEqual(expected);
      expect({
        attribution: await page.locator(".react-flow__attribution").count(),
        errors,
      }).toStrictEqual({ attribution: 0, errors: [] });
    } finally {
      await browser.close();
    }
  });

  it("previews collapsed patterns on hover, pins the rail, and navigates vertical tabs", async () => {
    const html = await render(
      GRAPH.replace(
        "<InteractiveGraph ",
        '<InteractiveGraph viewsCollapsed="true" '
      )
    );
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        viewport: { height: 1000, width: 1200 },
      });
      page.setDefaultTimeout(5000);
      await page.setContent(html);
      const rail = page.locator(".doc-graph-view-rail");
      const views = page.getByRole("tablist", { name: "表示する経路" });
      const all = views.getByRole("tab", { name: "全体" });
      const live = views.getByRole("tab", { name: "Live" });
      const label = live.getByText("Live", { exact: true });
      await expect(label.isVisible()).resolves.toBeFalsy();
      const canvas = page.locator(".doc-graph-canvas");
      const canvasBefore = await canvas.boundingBox();
      await rail.hover();
      await label.waitFor({ state: "visible" });
      expect({
        canvas: await canvas.boundingBox(),
        labelVisible: await label.isVisible(),
        selected: await all.getAttribute("aria-selected"),
      }).toStrictEqual({
        canvas: canvasBefore,
        labelVisible: true,
        selected: "true",
      });
      await page.mouse.move(1150, 950);
      await label.waitFor({ state: "hidden" });
      await expect(label.isVisible()).resolves.toBeFalsy();
      await page.getByRole("button", { name: "パターン一覧を展開" }).click();
      await page.mouse.move(1150, 950);
      await label.waitFor({ state: "visible" });
      await expect(label.isVisible()).resolves.toBeTruthy();
      await all.focus();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("End");
      await page.waitForFunction(
        () =>
          document
            .querySelector('.doc-graph-view-tab[aria-selected="true"]')
            ?.getAttribute("aria-label") === "Live"
      );
      expect({
        focused: await live.evaluate(
          (element) => element === document.activeElement
        ),
        selected: await live.getAttribute("aria-selected"),
      }).toStrictEqual({ focused: true, selected: "true" });
    } finally {
      await browser.close();
    }
  });

  it("hydrates offline, switches exact paths, selects by keyboard, and preserves dragged positions", async () => {
    const html = await render(GRAPH);
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        viewport: { height: 1000, width: 1200 },
      });
      page.setDefaultTimeout(5000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("https://**", async (route) => {
        await route.abort();
      });
      await page.setContent(html);
      const views = page.getByRole("tablist", { name: "表示する経路" });
      await views.getByRole("tab", { name: "Write" }).click();
      await page.waitForFunction(
        () =>
          document
            .querySelector('.doc-graph-view-tab[aria-selected="true"]')
            ?.getAttribute("aria-label") === "Write"
      );
      await expect(
        page.evaluate(() => ({
          edges: [
            ...document.querySelectorAll<HTMLElement>(".doc-graph-edge-dimmed"),
          ].map((edge) => edge.dataset.id),
          nodes: document.querySelectorAll(".doc-graph-node-card[data-dimmed]")
            .length,
        }))
      ).resolves.toStrictEqual({ edges: ["publish"], nodes: 1 });
      const api = page.getByRole("button", { exact: true, name: "API" });
      await api.focus();
      await page.keyboard.press("Enter");
      const details = page.getByRole("region", { name: "ノードの詳細" });
      await page.waitForFunction(() =>
        document
          .querySelector(".doc-graph-details")
          ?.textContent?.includes("Accepts document changes.")
      );
      const [bodyVisible, href] = await Promise.all([
        details.getByText("Accepts document changes.").isVisible(),
        details.getByRole("link").getAttribute("href"),
      ]);
      expect({ bodyVisible, href }).toStrictEqual({
        bodyVisible: true,
        href: "https://example.com/api",
      });
      await details.getByRole("button", { name: "詳細を閉じる" }).focus();
      await page.keyboard.press("Escape");
      await page.waitForFunction(
        () => document.querySelector(".doc-graph-details") === null
      );
      await expect(
        api.evaluate((element) => element === document.activeElement)
      ).resolves.toBeTruthy();
      await page.keyboard.press("Enter");
      const before = await api.evaluate((element) => element.style.transform);
      await page.keyboard.press("ArrowDown");
      await page.waitForFunction(
        (style) =>
          document.querySelector<HTMLElement>(
            '.react-flow__node[data-id="api"]'
          )?.style.transform !== style,
        before
      );
      const moved = await api.evaluate((element) => element.style.transform);
      await views.getByRole("tab", { name: "Live" }).click();
      await expect(
        api.evaluate((element) => element.style.transform)
      ).resolves.toBe(moved);
      await page.getByRole("button", { name: "配置を戻す" }).click();
      await page.waitForFunction(
        (style) =>
          document.querySelector<HTMLElement>(
            '.react-flow__node[data-id="api"]'
          )?.style.transform === style,
        before
      );
      expect(errors).toStrictEqual([]);
    } finally {
      await browser.close();
    }
  });
});

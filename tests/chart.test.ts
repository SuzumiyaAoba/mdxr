import { describe, expect, it } from "vitest";

import { mdxToAscii } from "../src/ascii/index.js";
import { numOf } from "../src/ui/attrs.js";
import {
  fmtNum,
  layoutSankey,
  niceBounds,
  niceScale,
  squarify,
} from "../src/ui/chart.js";
import { renderDoc } from "./helpers.js";

describe("chart numeric attributes", () => {
  it.each([
    [".5", 0.5],
    ["-.25ms", -0.25],
    ["1e3", 1000],
    ["2.5e-3s", 0.0025],
    ["40%", 40],
    ["  +120ms", 120],
  ])("reads %s without changing its numeric value", (value, expected) => {
    expect(numOf(value)).toBe(expected);
  });

  it("rejects values that overflow even when provided as strings", () => {
    expect(numOf("9".repeat(400))).toBeUndefined();
    expect(numOf("1e999")).toBeUndefined();
  });

  it("preserves small nonzero values in chart labels", () => {
    expect(fmtNum(0.001)).toBe("0.001");
    expect(fmtNum(-0.00025)).toBe("-0.00025");
    expect(fmtNum(1250)).toBe("1.25k");
  });

  it("uses the same numeric lists for HTML and ASCII charts", async () => {
    const values = ".1 .4 1e999 .2 8e-1 .3";
    const { markdown } = await mdxToAscii(
      `<Spark values="${values}" />`,
      "chart.mdx"
    );
    expect(markdown.trim()).toBe("▁▄▂█▃");
    const { body: html } = await renderDoc(`<Spark values="${values}" />`);
    expect(html).toContain("polyline");
    expect(html).not.toMatch(/NaN|Infinity/u);
  });
});

describe("chart geometry", () => {
  it("keeps fractional ticks distinct and limits work for tiny scales", () => {
    const scale = niceScale(0.001);
    expect(scale.ceil).toBe(0.001);
    expect(scale.ticks).toStrictEqual([0.00025, 0.0005, 0.00075, 0.001]);
    expect(niceScale(1e-12).ticks.length).toBeLessThanOrEqual(6);
    const bounds = niceBounds(-0.001, 0.001);
    expect(bounds.ticks).toStrictEqual([-0.001, -0.0005, 0, 0.0005, 0.001]);
  });

  it.each([
    Number.MIN_VALUE,
    1e-150,
    1e150,
    Number.MAX_VALUE,
    Infinity,
    Number.NaN,
  ])("terminates with finite geometry for an extreme scale: %s", (value) => {
    const scale = niceScale(value);
    expect(
      [scale.ceil, scale.step, ...scale.ticks].every(Number.isFinite)
    ).toBeTruthy();
    expect(scale.ceil).toBeGreaterThan(0);
    expect(scale.ticks.length).toBeLessThanOrEqual(103);
    const bounds = niceBounds(-value, value);
    expect(
      [bounds.min, bounds.max, ...bounds.ticks].every(Number.isFinite)
    ).toBeTruthy();
    expect(bounds.min).toBeLessThan(bounds.max);
  });

  it("handles equal large bounds and invalid or excessive tick counts", () => {
    expect(niceBounds(1e20, 1e20).min).toBeLessThan(niceBounds(1e20, 1e20).max);
    expect(niceScale(10, 0).ticks.length).toBeGreaterThan(0);
    expect(niceScale(10, 1e10).ticks.length).toBeLessThanOrEqual(103);
  });

  it("keeps treemap geometry invariant when all values use a different unit", () => {
    const canvas = { h: 56.25, w: 100, x: 0, y: 0 };
    const values = [6, 4, 3, 2, 1];
    const small = squarify(values, canvas);
    const large = squarify(
      values.map((value) => value * 1000),
      canvas
    );
    for (const [i, rect] of small.entries()) {
      expect(large[i]?.x).toBeCloseTo(rect.x);
      expect(large[i]?.y).toBeCloseTo(rect.y);
      expect(large[i]?.w).toBeCloseTo(rect.w);
      expect(large[i]?.h).toBeCloseTo(rect.h);
    }
  });

  it("fills the entire treemap canvas with a single tile", async () => {
    const { body: html } = await renderDoc(
      '<Treemap><Tile name="Everything" value="1" /></Treemap>'
    );
    expect(html).toContain('style="height:100%;left:0%;top:0%;width:100%"');
  });

  it("keeps bubble radii finite when a size is negative", async () => {
    const { body: html } = await renderDoc(`<Scatter>
<Point name="Negative" x="1" y="1" size="-5" />
<Point name="Positive" x="2" y="2" size="5" />
</Scatter>`);
    expect(html).not.toMatch(/NaN|Infinity/u);
    expect(html).toContain('r="4"');
  });

  it("keeps crowded Sankey nodes and ribbons inside the available height", () => {
    const links = Array.from({ length: 30 }, (_, i) => ({
      from: `source${i}`,
      to: "target",
      value: i + 1,
    }));
    const layout = layoutSankey({ links, nodes: [] }, 300, 14);
    expect(layout.k).toBeGreaterThan(0);
    for (const node of layout.nodes) {
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y + node.h).toBeLessThanOrEqual(300 + 1e-9);
    }
    expect(
      layout.links.every((link) => link.sy >= 0 && link.ty >= 0)
    ).toBeTruthy();
  });

  it.each([-1, 0.5, Infinity, Number.NaN])(
    "rejects invalid Sankey stages: %s",
    (stage) => {
      expect(() =>
        layoutSankey({ links: [], nodes: [{ id: "bad", stage }] }, 300, 14)
      ).toThrow("stage");
    }
  );

  it("supports sparse explicit stages without allocating empty columns", () => {
    const layout = layoutSankey(
      {
        links: [{ from: "a", to: "b", value: 1 }],
        nodes: [{ id: "b", stage: 2 ** 32 }],
      },
      300,
      14
    );
    expect(layout.nodes).toHaveLength(2);
    expect(layout.stages).toBe(2 ** 32 + 1);
    expect(
      layout.nodes.every((node) => Number.isFinite(node.y) && node.h > 0)
    ).toBeTruthy();
  });

  it("does not draw nonpositive Sankey quantities as visible flows", async () => {
    const { body } = await renderDoc(
      '<Sankey><Link from="a" to="b" value="0" /><Link from="a" to="c" value="-2" /></Sankey>'
    );
    expect(body).not.toContain("<path");
    expect(body).toContain("<rect");
  });

  it("retains edge-only graph content when there are no node definitions", async () => {
    const { body } = await renderDoc(
      '<Graph><Edge from="source" to="target" label="request" /></Graph>'
    );
    expect(body).toContain("source");
    expect(body).toContain("target");
    expect(body).toContain("request");
  });

  it("does not draw tasks or milestones outside explicit Gantt bounds", async () => {
    const { body } =
      await renderDoc(`<Gantt start="2026-02-01" end="2026-02-10">
<Task name="Early task" start="2026-01-01" end="2026-01-03" />
<Task name="Late task" start="2026-03-01" />
<Milestone name="Early milestone" date="2026-01-31" />
<Milestone name="Late milestone" date="2026-02-11" />
</Gantt>`);
    expect(body).toContain("Early task");
    expect(body).not.toMatch(/title="(?:Early|Late) (?:task|milestone)/u);
  });

  it.each([
    ["dash", true],
    ['dash="true"', true],
    ['dash="false"', false],
  ])(
    "honors the dash flag on standalone series: %s",
    async (dash, expected) => {
      const { body: html } = await renderDoc(
        `<Series name="A" values="1,2" ${dash} />`
      );
      expect(html.includes(">dash</span>")).toBe(expected);
    }
  );
});

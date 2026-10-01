import { describe, expect, it } from "vitest";

import { renderDoc } from "./helpers.js";

describe("graph edge colors", () => {
  it("uses an edge's color before the graph default and kind palette", async () => {
    const { body } = await renderDoc(`<Graph edgeColor="#64748b">
  <Node id="a" /><Node id="b" /><Node id="c" />
  <Edge from="a" to="b" kind="writes" />
  <Edge from="b" to="c" kind="calls" color="#0d9488" />
</Graph>`);
    expect(body).toContain('style="color:#64748b"');
    expect(body).toContain('style="color:#0d9488"');
  });

  it.each([
    "#abc",
    "#abcd",
    "#0d9488ff",
    "teal",
    "rgb(13 148 136 / 80%)",
    "hsl(175, 84%, 32%)",
    "oklch(0.6 0.1 175)",
    "var(--brand-color)",
  ])("accepts CSS color %s", async (color) => {
    const { body } = await renderDoc(`<Graph>
  <Node id="a" /><Node id="b" />
  <Edge from="a" to="b" color="${color}" />
</Graph>`);
    expect(body).toContain(`style="color:${color}"`);
  });

  it.each(["Graph", "InteractiveGraph"])(
    "%s rejects malformed colors and URL paints",
    async (component) => {
      await expect(
        renderDoc(`<${component} edgeColor="#12">
  <Node id="a" /><Node id="b" /><Edge from="a" to="b" />
</${component}>`)
      ).rejects.toThrow("expected a CSS color");
      await expect(
        renderDoc(`<${component}>
  <Node id="a" /><Node id="b" />
  <Edge from="a" to="b" color="url(https://example.com/paint.svg)" />
</${component}>`)
      ).rejects.toThrow("expected a CSS color");
    }
  );
});

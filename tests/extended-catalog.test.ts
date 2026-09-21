import path from "node:path";

import { describe, expect, it } from "vitest";

import { mdxToAscii } from "../src/ascii/index.js";
import { catalogEntries } from "../src/catalog.js";
import { EXTENDED_FEATURES } from "../src/extended/catalog.js";
import { exportIndex } from "../src/hydrate.js";
import specimens from "./fixtures/extended-catalog.json";
import { renderDoc } from "./helpers.js";

describe("extended component catalog", () => {
  it("covers every proposed feature, public child, and hydration export", async () => {
    expect(EXTENDED_FEATURES).toHaveLength(120);
    expect(specimens.map((item) => item.name)).toStrictEqual(
      EXTENDED_FEATURES.map((item) => item.name)
    );
    const entries = new Map(
      catalogEntries().map((entry) => [entry.name, entry])
    );
    const { map, surfaces } = await exportIndex();
    for (const name of [
      ...EXTENDED_FEATURES.flatMap((item) => item.components),
      "RecordItem",
    ]) {
      expect(entries.get(name)?.description).toBeTruthy();
      expect(map.has(name)).toBeTruthy();
      expect(surfaces.components.has(name)).toBeTruthy();
    }
  });

  it.each(specimens)(
    "$name produces HTML and readable Markdown",
    async ({ category, source }) => {
      const file = path.resolve(`examples/catalog/extended-${category}.mdx`);
      const { body } = await renderDoc(source, file);
      const { markdown, warnings } = await mdxToAscii(source, file);
      expect(body).not.toBe("");
      expect(body).not.toMatch(/(?:NaN|Infinity|undefined)(?:px|%|")/u);
      expect(markdown.trim()).not.toBe("");
      expect(warnings).toStrictEqual([]);
    }
  );

  it.each([
    '<DataTable data=\'[{"name":"Alpha","count":2}]\' />',
    "<DataTable>\n\n```csv\nname,count\nAlpha,2\n```\n\n</DataTable>",
    "<DataTable>\n\n| name | count |\n| --- | --- |\n| Alpha | 2 |\n\n</DataTable>",
    '<DataTable><RecordItem name="Alpha" count="2" /></DataTable>',
    ':::datatable\n\n```json\n[{"name":"Alpha","count":2}]\n```\n\n:::',
  ])("accepts tabular input: %s", async (source) => {
    const [{ body }, { markdown }] = await Promise.all([
      renderDoc(source),
      mdxToAscii(source),
    ]);
    expect(body).toContain("Alpha");
    expect(markdown).toContain("Alpha");
    expect(markdown).toContain("2");
  });

  it("keeps all table rows and tab bodies available without JavaScript", async () => {
    const rows = Array.from({ length: 15 }, (_, i) => ({ name: `Row ${i}` }));
    const { body } = await renderDoc(
      `<DataTable pageSize="2" data='${JSON.stringify(rows)}' />\n\n<SyncedTabs><TabItem label="A">Alpha</TabItem><TabItem label="B">Beta</TabItem></SyncedTabs>`
    );
    expect(body).toContain("Row 14");
    expect(body).toContain("Beta");
    expect(body).not.toContain('hidden=""');
  });

  it.each([
    '<DataTable data="[[1,2]]" />',
    '<Heatmap options="[]" />',
    '<ObjectSchema schema="[]" />',
  ])("rejects arrays where named fields are required: %s", async (source) => {
    await expect(renderDoc(source)).rejects.toThrow(/object|schema/iu);
    await expect(mdxToAscii(source)).rejects.toThrow(/object|schema/iu);
  });
});

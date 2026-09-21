import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { mdxToAscii } from "../src/ascii/index.js";
import { renderDoc } from "./helpers.js";

describe("document references", () => {
  it("resolves forward references, numbers, source metadata and citation backlinks", async () => {
    const source =
      'See <CrossRef target="plot" /> and <Cite source="book" />.\n\n<TableOfFigures />\n\n<Figure id="plot" src="plot.svg" caption="Latency" />\n\n<Sources><Source id="book" href="https://example.com" title="Measurement guide" author="Team" /></Sources>';
    const { body } = await renderDoc(source);
    for (const value of [
      'href="#plot"',
      "Figure 1: Latency",
      'href="#mdxr-citation-1"',
      'id="mdxr-citation-1"',
    ]) {
      expect(body).toContain(value);
    }
    const { markdown } = await mdxToAscii(source);
    expect(markdown).toContain('<a id="plot"></a>');
    expect(markdown).toContain('<a id="book"></a>');
    expect(markdown).toContain("Measurement guide");
    expect(markdown).toContain("#plot");
  });

  it.each([
    ['<CrossRef target="absent" />', "Unknown cross reference"],
    ['<Cite source="absent" />', "Unknown citation"],
    [
      '<Theorem id="same">A</Theorem>\n\n<Theorem id="same">B</Theorem>',
      "Duplicate reference",
    ],
  ])("rejects invalid references: %s", async (source, message) => {
    await expect(renderDoc(source)).rejects.toThrow(message);
    await expect(mdxToAscii(source)).rejects.toThrow(message);
  });
});

describe("Include expansion", () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map(async (dir) => {
        await rm(dir, { force: true, recursive: true });
      })
    );
  });

  it("selects sections, rebases nested relative paths and shares the HTML/ASCII pipeline", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-include-"));
    dirs.push(dir);
    await mkdir(path.join(dir, "parts"));
    await writeFile(
      path.join(dir, "parts", "leaf.mdx"),
      "Leaf content.\n\n![Diagram](diagram.svg)"
    );
    await writeFile(
      path.join(dir, "parts", "chapter.mdx"),
      '---\ntitle: Inner\n---\n\n## Selected\n\n<Include path="leaf.mdx" />\n\n## Excluded\n\nDo not include this.'
    );
    const source = '<Include path="parts/chapter.mdx" section="selected" />';
    const file = path.join(dir, "root.mdx");
    const { body } = await renderDoc(source, file);
    const { markdown } = await mdxToAscii(source, file);
    for (const output of [body, markdown]) {
      expect(output).toContain("Leaf content");
      expect(output).toContain("parts/diagram.svg");
      expect(output).not.toContain("Do not include");
    }
    const directive =
      ':::include{path="parts/chapter.mdx" section="selected"}\n:::';
    const directiveHtml = await renderDoc(directive, file);
    const directiveText = await mdxToAscii(directive, file);
    expect(directiveHtml.body).toContain("Leaf content");
    expect(directiveText.markdown).toContain("Leaf content");
  });

  it("rejects cycles, missing sections, and executable expressions inside includes", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-include-errors-"));
    dirs.push(dir);
    const file = path.join(dir, "root.mdx");
    await writeFile(
      path.join(dir, "cycle.mdx"),
      '<Include path="cycle.mdx" />'
    );
    await expect(
      renderDoc('<Include path="cycle.mdx" />', file)
    ).rejects.toThrow("cycle");
    await writeFile(path.join(dir, "plain.md"), "# Actual\n\nText");
    await expect(
      mdxToAscii('<Include path="plain.md" section="missing" />', file)
    ).rejects.toThrow("section not found");
    await writeFile(path.join(dir, "code.mdx"), "{process.exit(1)}");
    await expect(
      renderDoc('<Include path="code.mdx" />', file)
    ).rejects.toThrow("JavaScript expressions");
  });
});

import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
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
      'href="#doc-citation-1"',
      'id="doc-citation-1"',
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

  it("selects duplicate sections by the collision-safe heading slug", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-include-slugs-"));
    dirs.push(dir);
    await writeFile(
      path.join(dir, "sections.mdx"),
      "## Repeat\n\nFirst section.\n\n## Repeat\n\nSecond section.\n"
    );
    const { body } = await renderDoc(
      '<Include path="sections.mdx" section="repeat-1" />',
      path.join(dir, "root.mdx")
    );
    expect(body).toContain("Second section.");
    expect(body).not.toContain("First section.");
  });

  it("retains definitions outside selected sections, including references in footnotes", async () => {
    const dir = await mkdtemp(
      path.join(os.tmpdir(), "mdxr-include-definitions-")
    );
    dirs.push(dir);
    await writeFile(
      path.join(dir, "part.md"),
      [
        "## Selected",
        "",
        "[Reference][url] and ![Image][image] and note[^n].",
        "",
        "## Outside",
        "",
        "Do not include this paragraph.",
        "",
        "[url]: https://example.com/reference",
        "[image]: image.svg",
        "[^n]: Footnote [reference][foot].",
        "[foot]: https://example.com/footnote",
      ].join("\n")
    );
    const source = '<Include path="part.md" section="selected" />';
    const file = path.join(dir, "root.mdx");
    const { body } = await renderDoc(source, file);
    const { markdown } = await mdxToAscii(source, file);
    expect(body).toContain('href="https://example.com/reference"');
    expect(body).toContain('src="image.svg"');
    expect(body).toContain('href="https://example.com/footnote"');
    for (const output of [body, markdown]) {
      expect(output).toContain("Footnote");
      expect(output).not.toContain("Do not include this paragraph.");
    }
    expect(markdown).toContain("https://example.com/reference");
    expect(markdown).toContain("https://example.com/footnote");
  });

  it("keeps references and footnotes scoped to their original documents", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-include-scopes-"));
    dirs.push(dir);
    await writeFile(
      path.join(dir, "first.md"),
      "[First][ref] and note[^n].\n\n[ref]: https://first.example\n[^n]: First footnote.\n"
    );
    await writeFile(
      path.join(dir, "second.md"),
      "[Second][ref] and note[^n].\n\n[ref]: https://second.example\n[^n]: Second footnote.\n"
    );
    const source =
      '[Root][ref]\n\n<Include path="first.md" />\n\n<Include path="second.md" />\n\n[ref]: https://root.example';
    const file = path.join(dir, "root.mdx");
    const { body } = await renderDoc(source, file);
    const { markdown } = await mdxToAscii(source, file);
    for (const output of [body, markdown]) {
      expect(output).toContain("https://root.example");
      expect(output).toContain("https://first.example");
      expect(output).toContain("https://second.example");
      expect(output).toContain("First footnote.");
      expect(output).toContain("Second footnote.");
    }
  });

  it("counts nested headings when resolving a top-level section slug", async () => {
    const dir = await mkdtemp(
      path.join(os.tmpdir(), "mdxr-include-nested-slugs-")
    );
    dirs.push(dir);
    await writeFile(
      path.join(dir, "sections.mdx"),
      "> ## Repeat\n>\n> Nested section.\n\n## Repeat\n\nRoot section.\n"
    );

    const { body } = await renderDoc(
      '<Include path="sections.mdx" section="repeat-1" />',
      path.join(dir, "document.mdx")
    );

    expect(body).toContain("Root section.");
    expect(body).not.toContain("Nested section.");
  });

  it("rejects inline Include elements that would create invalid paragraph markup", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-include-inline-"));
    dirs.push(dir);
    await writeFile(path.join(dir, "inline.mdx"), "Included text.\n");

    await expect(
      renderDoc(
        'Before <Include path="inline.mdx" /> after.',
        path.join(dir, "root.mdx")
      )
    ).rejects.toThrow("Include must be used as a block element");
  });

  it.each([
    '<CrossRef target="missing" />',
    '<Cite source="missing" />',
    '<ResearchClaim kind="proposal" source="missing">Needs evidence.</ResearchClaim>',
  ])(
    "reports included reference failures at their original source: %s",
    async (reference) => {
      const dir = await mkdtemp(
        path.join(os.tmpdir(), "mdxr-include-reference-errors-")
      );
      dirs.push(dir);
      const included = path.join(dir, "part.mdx");
      await writeFile(included, `# Included\n\n${reference}\n`);
      const source = '<Include path="part.mdx" />';
      const file = path.join(dir, "root.mdx");
      const location = { file: await realpath(included), line: 3 };

      await expect(renderDoc(source, file)).rejects.toMatchObject(location);
      await expect(mdxToAscii(source, file)).rejects.toMatchObject(location);
    }
  );

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

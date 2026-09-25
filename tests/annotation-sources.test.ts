import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { renderDoc } from "./helpers.js";

describe("annotation source locations", () => {
  it("indexes formatted text and figures without changing the rendered tree", async () => {
    const { annotationSources, body } = await renderDoc(
      '# Design\n\nRender **rich text** and diagrams.\n\n<Figure src="design.svg" caption="Architecture" />',
      "/project/plan.mdx"
    );
    expect(body).toContain(
      "<p>Render <strong>rich text</strong> and diagrams.</p>"
    );
    expect(annotationSources).toContainEqual({
      end: 3,
      file: "/project/plan.mdx",
      heading: "Design",
      image: "",
      label: "",
      start: 3,
      text: "Render rich text and diagrams.",
    });
    expect(annotationSources).toContainEqual({
      end: 5,
      file: "/project/plan.mdx",
      heading: "Design",
      image: "design.svg",
      label: "Architecture",
      start: 5,
      text: "",
    });
  });

  it("attributes included content to its own source file and original line numbers", async () => {
    const dir = await mkdtemp(
      path.join(os.tmpdir(), "mdxr-annotation-source-")
    );
    try {
      const included = path.join(dir, "section.mdx");
      await writeFile(included, "# Included\n\nSelected **passage**.\n");
      const { annotationSources } = await renderDoc(
        '# Main\n\n<Include path="section.mdx" />',
        path.join(dir, "main.mdx")
      );
      expect(annotationSources).toContainEqual({
        end: 3,
        file: await realpath(included),
        heading: "Included",
        image: "",
        label: "",
        start: 3,
        text: "Selected passage.",
      });
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });
});

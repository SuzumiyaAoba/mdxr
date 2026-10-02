import { createHash } from "node:crypto";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseAnnotationDocument } from "../src/annotations.js";
import { render } from "../src/render.js";
import { renderDoc } from "./helpers.js";

describe("annotation source locations", () => {
  it("embeds the original source hash separately from the compiled revision", async () => {
    const source = "---\ntitle: Source hash\n---\n\n日本語本文。\n";
    const html = await render(source, {
      filePath: path.join(os.tmpdir(), "source-hash.mdx"),
      hydrate: false,
    });
    const rawDocument =
      /<script type="application\/json" id="doc-annotation-document">(?<json>[\s\S]*?)<\/script>/u.exec(
        html
      )?.groups?.json;
    if (rawDocument === undefined) {
      throw new Error("Rendered annotation document was missing");
    }
    const document = parseAnnotationDocument(rawDocument);

    expect(document?.contentHash).toBe(
      createHash("sha256").update(source).digest("hex")
    );
    expect(document?.revision).not.toBe(document?.contentHash);
  });

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

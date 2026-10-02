import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { injectAgentPreview } from "../src/agent-preview.js";
import { clientJs } from "../src/client-js.js";
import { libraryHtml, libraryJs } from "../src/library-page.js";
import { render } from "../src/render.js";
import { workspaceJs } from "../src/workspace-js.js";

const DOCUMENT = `## Overview

:::toc
:::

<Details summary="Details">Document text.</Details>

\`\`\`ts
const value = 1;
\`\`\`

<Include path="part.mdx" />

<DocumentLink path="linked.mdx" label="Related document" />

## Controls

<Button>Continue</Button>

<Wireframe><WireframeText>Example</WireframeText></Wireframe>

<InteractiveGraph><Node id="a" label="A" /><Node id="b" label="B" /><Edge from="a" to="b" /></InteractiveGraph>`;

describe("generated document markup", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "document-output-"));
    await writeFile(
      path.join(dir, "part.mdx"),
      "## Included\n\nIncluded text."
    );
    await writeFile(path.join(dir, "linked.mdx"), "# Related\n\nRelated text.");
  });

  afterAll(async () => {
    await rm(dir, { force: true, recursive: true });
  });

  it.each([false, true])(
    "omits the package name from HTML, CSS and scripts (hydrate=%s)",
    async (hydrate) => {
      const html = await render(DOCUMENT, {
        dir,
        filePath: path.join(dir, "document.mdx"),
        hydrate,
        liveReload: true,
      });
      expect(html).not.toMatch(/mdxr/iu);
      expect(html).not.toContain('name="generator"');
      expect(html).toContain('id="doc-root"');
      expect({
        hydrated: html.includes('<script data-doc-hydration="true">'),
        included: html.includes("Included text."),
        related: html.includes("Related text."),
      }).toStrictEqual({ hydrated: hydrate, included: true, related: true });
      expect(injectAgentPreview(html, "codex")).not.toMatch(/mdxr/iu);
    }
  );

  it("uses a neutral title when no title or heading is authored", async () => {
    const html = await render("Document text.", { dir, hydrate: false });
    expect(html).toContain("<title>Document</title>");
    expect(html).not.toMatch(/mdxr/iu);
  });

  it("preserves authored text and explicitly supplied paths", async () => {
    const html = await render("# mdxr\n\nMDXR document.", {
      dir,
      filePath: path.join(dir, "mdxr.mdx"),
      hydrate: false,
    });
    expect(html).toContain("<title>mdxr</title>");
    expect(html).toContain("MDXR document.");
    expect(html).toContain("mdxr.mdx");
  });

  it("omits the package name from the library and browser bundles", async () => {
    const html = await libraryHtml();
    expect(html).not.toMatch(/mdxr/iu);
    for (const script of await Promise.all([
      clientJs(),
      libraryJs(),
      workspaceJs(),
    ])) {
      expect(script).not.toMatch(/mdxr/iu);
      expect(() => new vm.Script(script)).not.toThrow();
    }
  });
});

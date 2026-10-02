import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mdxToAscii } from "../src/ascii/index.js";
import { editorUrl } from "../src/editor.js";
import { mdxToHtml } from "../src/mdx.js";
import { builtinComponents } from "../src/ui/index.js";

describe("included inline file references", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await realpath(
      await mkdtemp(path.join(os.tmpdir(), "mdxr-include-paths-"))
    );
    await mkdir(path.join(dir, "chapters", "src"), { recursive: true });
    await mkdir(path.join(dir, "src"));
    await writeFile(path.join(dir, "src", "sample.ts"), "ROOT_FILE\n");
    await writeFile(
      path.join(dir, "chapters", "src", "sample.ts"),
      "INCLUDED_FILE\n"
    );
  });

  afterEach(async () => {
    await rm(dir, { force: true, recursive: true });
  });

  it.each([true, false])(
    "resolves included inline paths and line ranges when a root file exists=%s",
    async (rootFileExists) => {
      if (!rootFileExists) {
        await rm(path.join(dir, "src", "sample.ts"));
      }
      await writeFile(
        path.join(dir, "chapters", "part.mdx"),
        "See `src/sample.ts:2-4` and `src/missing.ts`.\n\n[Linked `src/sample.ts`](https://example.com)."
      );
      const source = '<Include path="chapters/part.mdx" />';
      const file = path.join(dir, "index.mdx");
      const { body, fileLinks } = await mdxToHtml(
        source,
        builtinComponents,
        file,
        {
          hydrate: false,
        }
      );
      expect(fileLinks["chapters/src/sample.ts\u00002"]).toBe(
        editorUrl(
          undefined,
          path.join(dir, "chapters", "src", "sample.ts"),
          "2"
        )
      );
      expect(Object.keys(fileLinks)).not.toContain("src/sample.ts\u00002");
      expect(body).toContain("src/missing.ts");
      expect(body).toMatch(
        /<a[^>]*href="https:\/\/example.com"[^>]*>Linked <code[^>]*>src\/sample.ts<\/code><\/a>/u
      );
      const { markdown } = await mdxToAscii(source, file);
      expect(markdown).toContain("chapters/src/sample.ts");
    }
  );

  it("resolves nested include references without redirecting root document references", async () => {
    await mkdir(path.join(dir, "chapters", "nested"));
    await writeFile(
      path.join(dir, "chapters", "part.mdx"),
      '<Include path="nested/part.mdx" />'
    );
    await writeFile(
      path.join(dir, "chapters", "nested", "part.mdx"),
      "See `../src/sample.ts`."
    );
    const { fileLinks } = await mdxToHtml(
      'See `src/sample.ts`.\n\n<Include path="chapters/part.mdx" />',
      builtinComponents,
      path.join(dir, "index.mdx"),
      { hydrate: false }
    );
    expect(fileLinks["chapters/src/sample.ts\0"]).toBe(
      editorUrl(undefined, path.join(dir, "chapters", "src", "sample.ts"))
    );
    expect(fileLinks["src/sample.ts\0"]).toBe(
      editorUrl(undefined, path.join(dir, "src", "sample.ts"))
    );
  });

  it("keeps absolute paths in included documents absolute", async () => {
    const absolutePath = path.join(dir, "chapters", "src", "sample.ts");
    await writeFile(
      path.join(dir, "chapters", "part.mdx"),
      `See \`${absolutePath}\`.`
    );
    const { fileLinks } = await mdxToHtml(
      '<Include path="chapters/part.mdx" />',
      builtinComponents,
      path.join(dir, "index.mdx"),
      { hydrate: false }
    );
    expect(fileLinks[`${absolutePath}\0`]).toBe(
      editorUrl(undefined, absolutePath)
    );
  });

  it("preserves URL queries and fragments when rebasing included resources", async () => {
    const imagePath = path.join(dir, "chapters", "src", "pixel.png");
    await writeFile(imagePath, Buffer.from([137, 80, 78, 71, 0]));
    await writeFile(
      path.join(dir, "chapters", "part.mdx"),
      '[Guide](guide.md?next=one/../two#section)\n\n<Figure src="src/pixel.png?next=one/../two#preview" />'
    );
    const { body, dependencies } = await mdxToHtml(
      '<Include path="chapters/part.mdx" />',
      builtinComponents,
      path.join(dir, "index.mdx"),
      { hydrate: false, include: { inlineAssets: true } }
    );

    expect(body).toContain('href="chapters/guide.md?next=one/../two#section"');
    expect(body).toContain("data:image/png;base64,iVBORwA=#preview");
    expect(dependencies).toContain(imagePath);
  });

  it("encodes included resource directories containing URL delimiters", async () => {
    const chapter = path.join(dir, "chapter #1%");
    await mkdir(chapter);
    await writeFile(path.join(chapter, "pixel.png"), Buffer.from([1, 2, 3]));
    await writeFile(
      path.join(chapter, "part.mdx"),
      "[Guide](guide.md#section)\n\n![Pixel](pixel.png)"
    );
    const { body } = await mdxToHtml(
      '<Include path="chapter #1%/part.mdx" />',
      builtinComponents,
      path.join(dir, "index.mdx"),
      { hydrate: false, include: { inlineAssets: true } }
    );

    expect(body).toContain('href="chapter%20%231%25/guide.md#section"');
    expect(body).toContain("data:image/png;base64,AQID");
  });

  it("links CodeFile headers to filenames containing double quotes", async () => {
    const codePath = path.join(dir, "chapters", "src", 'quo"te.ts');
    await writeFile(codePath, "const value = 1;\n");
    await writeFile(
      path.join(dir, "chapters", "part.mdx"),
      '<CodeFile path=\'src/quo"te.ts\' lines="1" />'
    );
    const { body, fileLinks } = await mdxToHtml(
      '<Include path="chapters/part.mdx" />',
      builtinComponents,
      path.join(dir, "index.mdx"),
      { hydrate: false }
    );

    expect(fileLinks['chapters/src/quo"te.ts\u00001']).toBe(
      editorUrl(undefined, codePath, "1")
    );
    expect(body).toContain("vscode://file/");
    expect(body).not.toContain("data-doc-code-path");
  });

  it.each([
    'title="src/sample.ts:2-4"',
    "filename='src/sample.ts:2-4'",
    "filename=src/sample.ts:2-4",
  ])(
    "resolves included code headers relative to their source (%s)",
    async (meta) => {
      await writeFile(
        path.join(dir, "chapters", "part.mdx"),
        `\`\`\`ts ${meta}\nconst value = 1;\n\`\`\`\n`
      );
      const { body, fileLinks } = await mdxToHtml(
        '<Include path="chapters/part.mdx" />',
        builtinComponents,
        path.join(dir, "index.mdx"),
        { hydrate: false }
      );

      expect(fileLinks["chapters/src/sample.ts\u00002"]).toBe(
        editorUrl(
          undefined,
          path.join(dir, "chapters", "src", "sample.ts"),
          "2"
        )
      );
      expect(Object.keys(fileLinks)).not.toContain("src/sample.ts\u00002");
      expect(body).toContain("src/sample.ts:2-4");
      expect(body).not.toContain("data-doc-code-path");
    }
  );

  it("keeps root and absolute code headers intact and rebases nested headers and CodeFile once", async () => {
    await mkdir(path.join(dir, "chapters", "nested"));
    const absolutePath = path.join(dir, "src", "sample.ts");
    await writeFile(
      path.join(dir, "chapters", "part.mdx"),
      '<Include path="nested/part.mdx" />\n\n<CodeFile path="src/sample.ts" />'
    );
    await writeFile(
      path.join(dir, "chapters", "nested", "part.mdx"),
      `\`\`\`ts title="../src/sample.ts"\nconst value = 1;\n\`\`\`\n\n\`\`\`ts title="${absolutePath}"\nconst value = 2;\n\`\`\`\n`
    );
    const { fileLinks } = await mdxToHtml(
      '```ts title="src/sample.ts"\nconst root = 1;\n```\n\n<Include path="chapters/part.mdx" />',
      builtinComponents,
      path.join(dir, "index.mdx"),
      { hydrate: false }
    );

    expect(fileLinks["src/sample.ts\0"]).toBe(
      editorUrl(undefined, absolutePath)
    );
    expect(fileLinks[`${absolutePath}\0`]).toBe(
      editorUrl(undefined, absolutePath)
    );
    expect(fileLinks["chapters/src/sample.ts\0"]).toBe(
      editorUrl(undefined, path.join(dir, "chapters", "src", "sample.ts"))
    );
    expect(fileLinks["chapters/chapters/src/sample.ts\0"]).toBeUndefined();
  });
});

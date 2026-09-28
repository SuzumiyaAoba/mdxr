import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { mdxToAscii } from "../src/ascii/index.js";
import { mdxToHtml } from "../src/mdx.js";
import { render } from "../src/render.js";
import { builtinComponents } from "../src/ui/index.js";

interface LinkedDocument {
  html: string;
  path: string;
}

const dirs: string[] = [];

const makeDir = async (prefix: string): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  dirs.push(dir);
  return dir;
};

const linkedDocumentId = (body: string): string => {
  const id = /data-mdxr-document="(?<id>[^"]+)"/u.exec(body)?.groups?.id;
  if (id === undefined) {
    throw new Error("Expected a linked-document anchor in the rendered body.");
  }
  return id;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const linkedDocumentsFromHtml = (
  html: string
): Record<string, LinkedDocument> => {
  const json =
    /<script\b(?=[^>]*\bid="mdxr-linked-documents")(?=[^>]*\btype="application\/json")[^>]*>(?<json>[\s\S]*?)<\/script>/u.exec(
      html
    )?.groups?.json;
  if (json === undefined) {
    throw new Error("Expected the linked-document JSON script in the HTML.");
  }

  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed)) {
    throw new Error("Expected a linked-document object in the JSON script.");
  }

  const documents: Record<string, LinkedDocument> = {};
  for (const [id, value] of Object.entries(parsed)) {
    if (
      !isRecord(value) ||
      !("html" in value) ||
      typeof value.html !== "string" ||
      !("path" in value) ||
      typeof value.path !== "string"
    ) {
      throw new Error(`Invalid linked-document entry: ${id}`);
    }
    documents[id] = { html: value.html, path: value.path };
  }
  return documents;
};

describe("DocumentLink", () => {
  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map(async (dir) => {
        await rm(dir, { force: true, recursive: true });
      })
    );
  });

  it.each(["md", "mdx"] as const)(
    "renders a .%s target as a separately themed HTML document from unsaved source",
    async (extension) => {
      const dir = await makeDir("mdxr-include-link-extension-");
      const target = path.join(dir, `guide.${extension}`);
      await mkdir(path.join(dir, "refs"));
      await writeFile(
        path.join(dir, "refs", "ordinary.mdx"),
        "Reference file.\n"
      );
      const source = `<DocumentLink path="guide.${extension}" label="Open guide" section="chosen" />\n\n[Ordinary link](guide.${extension})\n\nSee \`refs/ordinary.mdx\`.`;
      await writeFile(
        target,
        "## Chosen\n\nSelected target content.\n\n## Hidden\n\nExcluded target content.\n"
      );
      const filePath = path.join(dir, "unsaved-root.mdx");
      const result = await mdxToHtml(source, builtinComponents, filePath, {
        hydrate: false,
      });

      expect([
        result.body.includes("Open guide"),
        result.body.includes("Selected target content"),
      ]).toStrictEqual([true, false]);
      expect(result.body).toMatch(
        /<a\b(?=[^>]*\bdata-mdxr-document="[^"]+")(?=[^>]*\btarget="_blank")(?=[^>]*\brel="noopener noreferrer")[^>]*>/u
      );
      expect([
        result.body.includes(`href="guide.${extension}"`),
        result.body.includes("vscode://file/"),
      ]).toStrictEqual([true, true]);

      const id = linkedDocumentId(result.body);
      const rendered = await render(source, {
        dir,
        filePath: "unsaved-root.mdx",
        hydrate: false,
      });
      const linked = linkedDocumentsFromHtml(rendered)[id];
      expect(linked?.path).toBe(`guide.${extension}`);
      expect([
        linked?.html.includes("Selected target content."),
        linked?.html.includes("Excluded target content."),
      ]).toStrictEqual([true, false]);
    }
  );

  it("rebases nested paths, narrows a linked section, and records link ancestry", async () => {
    const dir = await makeDir("mdxr-include-link-section-");
    await mkdir(path.join(dir, "chapters"));
    await mkdir(path.join(dir, "docs"));
    const chapterFile = path.join(dir, "chapters", "chapter.mdx");
    const targetFile = path.join(dir, "docs", "article.mdx");
    await writeFile(
      chapterFile,
      '<DocumentLink path="../docs/article.mdx" label="Open selected" section="picked" />'
    );
    await writeFile(
      targetFile,
      "## Picked\n\nOnly selected section.\n\n## Other\n\nDo not show this section.\n"
    );
    const chapter = await realpath(chapterFile);
    const target = await realpath(targetFile);

    const source = '<Include path="chapters/chapter.mdx" />';
    const filePath = path.join(dir, "unsaved-root.mdx");
    const result = await mdxToHtml(source, builtinComponents, filePath, {
      hydrate: false,
    });
    const reference = result.linkedDocuments.find(
      (document) => document.path === target
    );
    expect([
      result.dependencies.includes(chapter),
      result.dependencies.includes(target),
      reference?.section === "picked",
      reference?.ancestors.includes(chapter),
    ]).toStrictEqual([true, true, true, true]);

    const { markdown } = await mdxToAscii(source, filePath);
    expect(markdown).toContain("[Open selected](docs/article.mdx#picked)");
    expect(markdown).not.toMatch(
      /Only selected section|Do not show this section/u
    );
  });

  it("passes the root theme and custom components to linked documents", async () => {
    const dir = await makeDir("mdxr-include-link-config-");
    await writeFile(
      path.join(dir, "mdxr.config.ts"),
      'export default { components: "./components.tsx", theme: "./theme.css" };\n'
    );
    await writeFile(
      path.join(dir, "components.tsx"),
      `import { defineComponent, v } from "@suzumiyaaoba/mdxr";
export const ProjectBadge = defineComponent(
  { schema: v.looseObject({ label: v.string() }) },
  ({ label }) => <strong className="project-badge" data-project-badge>{label}</strong>
);
`
    );
    await writeFile(
      path.join(dir, "theme.css"),
      ".project-badge { --linked-document-theme-marker: 1; }\n"
    );
    await writeFile(
      path.join(dir, "guide.mdx"),
      '## Chosen\n\n<ProjectBadge label="Rendered from the project component" />\n'
    );

    const html = await render(
      '<DocumentLink path="guide.mdx" label="Open guide" section="chosen" />',
      { dir, filePath: "unsaved-root.mdx", hydrate: false }
    );
    const id = linkedDocumentId(html);
    const linked = linkedDocumentsFromHtml(html)[id];

    expect(linked?.html).toContain("data-project-badge");
    expect(linked?.html).toContain("Rendered from the project component");
    expect(linked?.html).toContain("--linked-document-theme-marker");
  });

  it("updates Include dependencies when the source changes between renders", async () => {
    const dir = await makeDir("mdxr-include-link-dependencies-");
    const projectDir = path.join(dir, "project");
    const outsideDir = path.join(dir, "shared");
    await mkdir(projectDir);
    await mkdir(outsideDir);
    const firstFile = path.join(outsideDir, "first.mdx");
    const secondFile = path.join(outsideDir, "second.md");
    await writeFile(firstFile, "First linked document.\n");
    await writeFile(secondFile, "Second linked document.\n");
    const firstPath = await realpath(firstFile);
    const secondPath = await realpath(secondFile);
    const rootPath = path.join(projectDir, "unsaved-root.mdx");
    const firstSource =
      '<DocumentLink path="../shared/first.mdx" label="First" />';

    const firstResult = await mdxToHtml(
      firstSource,
      builtinComponents,
      rootPath,
      { hydrate: false }
    );
    const firstReported: string[] = [];
    const firstHtml = await render(firstSource, {
      dir: projectDir,
      filePath: "unsaved-root.mdx",
      hydrate: false,
      onDependencies: (dependencies) => {
        firstReported.push(...dependencies);
      },
    });
    const firstId = linkedDocumentId(firstHtml);
    const firstLinkedHtml = linkedDocumentsFromHtml(firstHtml)[firstId]?.html;
    expect([
      firstResult.dependencies.includes(firstPath),
      firstReported.includes(firstPath),
      firstLinkedHtml?.includes("First linked document."),
    ]).toStrictEqual([true, true, true]);

    await writeFile(firstPath, "Updated first linked document.\n");
    const updatedHtml = await render(firstSource, {
      dir: projectDir,
      filePath: "unsaved-root.mdx",
      hydrate: false,
    });
    const updatedId = linkedDocumentId(updatedHtml);
    const updatedDocument = linkedDocumentsFromHtml(updatedHtml)[updatedId];
    expect(updatedDocument?.html).toContain("Updated first linked document.");
    expect(updatedDocument?.html).not.toContain("First linked document.");

    const secondReported: string[] = [];
    await render('<DocumentLink path="../shared/second.md" label="Second" />', {
      dir: projectDir,
      filePath: "unsaved-root.mdx",
      hydrate: false,
      onDependencies: (dependencies) => {
        secondReported.push(...dependencies);
      },
    });

    expect([
      secondReported.includes(secondPath),
      secondReported.includes(firstPath),
    ]).toStrictEqual([true, false]);
  });

  it("rejects unsupported files, missing paths or files, JavaScript, and mixed-mode cycles", async () => {
    const dir = await makeDir("mdxr-include-link-errors-");
    const filePath = path.join(dir, "unsaved-root.mdx");
    await writeFile(path.join(dir, "script.mdx"), "{process.exit(1)}\n");
    await writeFile(path.join(dir, "unsupported.txt"), "Plain text file.\n");
    await writeFile(
      path.join(dir, "embed.mdx"),
      '<DocumentLink path="linked.mdx" />\n'
    );
    await writeFile(
      path.join(dir, "linked.mdx"),
      '<Include path="embed.mdx" />\n'
    );

    await expect(
      mdxToHtml("<DocumentLink />", builtinComponents, filePath, {
        hydrate: false,
      })
    ).rejects.toThrow(/path/iu);
    await expect(
      mdxToHtml(
        '<DocumentLink path="missing.mdx" />',
        builtinComponents,
        filePath,
        { hydrate: false }
      )
    ).rejects.toThrow(/ENOENT/iu);
    await expect(
      mdxToHtml(
        '<DocumentLink path="unsupported.txt" />',
        builtinComponents,
        filePath,
        { hydrate: false }
      )
    ).rejects.toThrow(/unsupported|\.md/iu);
    await expect(
      render('<DocumentLink path="script.mdx" />', {
        dir,
        filePath: "unsaved-root.mdx",
        hydrate: false,
      })
    ).rejects.toThrow(/JavaScript expressions/iu);
    await expect(
      render('<Include path="embed.mdx" />', {
        dir,
        filePath: "unsaved-root.mdx",
        hydrate: false,
      })
    ).rejects.toThrow(/cycle/iu);
  });
});

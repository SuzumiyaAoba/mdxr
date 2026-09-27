import { execFile } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { build } from "esbuild";
import { describe, expect, it } from "vitest";

// oxlint-disable-next-line typescript/strict-void-return -- execFile supplies a custom promise API.
const execute = promisify(execFile);
const script = fileURLToPath(
  new URL("../scripts/render-examples.ts", import.meta.url)
);

describe("demo section rendering", () => {
  it("preserves fenced code and writes a unique file per section", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "mdxr-demo-split-"));
    const source = path.join(directory, "source");
    const output = path.join(directory, "output");
    try {
      // Tests also run on Node 20, which cannot execute TypeScript directly.
      const executable = path.join(directory, "render-examples.mjs");
      await build({
        define: { "import.meta.dirname": JSON.stringify(path.dirname(script)) },
        entryPoints: [script],
        format: "esm",
        outfile: executable,
        platform: "node",
        target: "node20",
      });
      await mkdir(source);
      await writeFile(
        path.join(source, "demo.mdx"),
        [
          "---",
          "title: Demo",
          "---",
          "# Demo",
          "",
          "```md",
          "# Code heading",
          ":::toc",
          ":::",
          "```",
          "",
          "## A",
          "",
          "```md",
          "~~~",
          "## Inside code",
          "```",
          "",
          "## A",
          "",
          "Second section",
          "",
          ":::toc",
          ":::",
          "",
          "## A-1",
          "",
          "Third section",
          "",
          "## A",
          "",
          "Fourth section",
          "",
        ].join("\r\n")
      );
      await execute(process.execPath, [executable, source, output, "--split"], {
        maxBuffer: 2 * 1024 * 1024,
      });
      const manifest: unknown = JSON.parse(
        await readFile(path.join(output, "sections.json"), "utf-8")
      );
      expect(manifest).toMatchObject({
        demo: {
          sections: [
            {
              slug: "overview",
              source: "```md\n# Code heading\n:::toc\n:::\n```",
              title: "Overview",
            },
            {
              slug: "a",
              source: "```md\n~~~\n## Inside code\n```",
              title: "A",
            },
            { slug: "a-1", source: "Second section", title: "A" },
            { slug: "a-1-1", source: "Third section", title: "A-1" },
            { slug: "a-2", source: "Fourth section", title: "A" },
          ],
        },
      });
      const files = await readdir(output);
      expect(files.filter((file) => file.startsWith("demo--"))).toHaveLength(5);
      await expect(
        readFile(path.join(output, "demo--a-1.html"), "utf-8")
      ).resolves.toContain("Second section");
      await expect(
        readFile(path.join(output, "demo--a-1-1.html"), "utf-8")
      ).resolves.toContain("Third section");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  }, 120_000);
});

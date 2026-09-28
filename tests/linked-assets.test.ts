import { realpathSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { compile } from "@mdx-js/mdx";
import { VFile } from "vfile";
import { afterEach, describe, expect, it } from "vitest";

import { rehypeLinkedAssets } from "../src/rehype/linked-assets.js";

const dirs: string[] = [];

const makeDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-linked-assets-"));
  dirs.push(dir);
  return dir;
};

const compileWithLinkedAssets = async (
  source: string,
  filePath: string,
  enabled = true
) => {
  const file = new VFile({ path: filePath, value: source });
  return await compile(file, {
    rehypePlugins: [[rehypeLinkedAssets, { enabled }]],
  });
};

describe("linked document local assets", () => {
  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map(async (dir) => {
        await rm(dir, { force: true, recursive: true });
      })
    );
  });

  it("inlines Markdown and JSX image sources and tracks canonical dependencies", async () => {
    const dir = await makeDir();
    const imagePath = path.join(dir, "pixel.png");
    const encodedImagePath = path.join(dir, "画像 photo.png");
    const image = Buffer.from([137, 80, 78, 71, 0]);
    await writeFile(imagePath, image);
    await writeFile(encodedImagePath, image);

    const file = await compileWithLinkedAssets(
      [
        "![Pixel](pixel.png)",
        "![Encoded path](%E7%94%BB%E5%83%8F%20photo.png)",
        '<Figure src="pixel.png" />',
        '<img src="pixel.png" />',
        '<video src="clip.mp4" poster="pixel.png" />',
      ].join("\n\n"),
      path.join(dir, "linked.mdx")
    );
    const output = String(file.value);

    expect(output.match(/data:image\/png;base64,/gu)).toHaveLength(5);
    expect(output).toContain(image.toString("base64"));
    expect(output).toContain("clip.mp4");
    expect(file.data.includeDependencies).toStrictEqual([
      realpathSync(imagePath),
      realpathSync(encodedImagePath),
    ]);
  });

  it("leaves remote and unknown-extension image URLs unchanged", async () => {
    const dir = await makeDir();
    const file = await compileWithLinkedAssets(
      [
        '<Figure src="https://example.com/cover.png" />',
        '<Figure src="unknown.image" />',
        '<toString src="prototype.image" />',
      ].join("\n\n"),
      path.join(dir, "linked.mdx")
    );
    const output = String(file.value);

    expect(output).toContain("https://example.com/cover.png");
    expect(output).toContain("unknown.image");
    expect(output).toContain("prototype.image");
    expect(file.data.includeDependencies).toBeUndefined();
  });

  it("only fails on a missing local image when enabled", async () => {
    const dir = await makeDir();

    await expect(
      compileWithLinkedAssets(
        '<Figure src="assets/missing.webp" />',
        path.join(dir, "linked.mdx")
      )
    ).rejects.toThrow("Linked image not found: assets/missing.webp");

    const disabled = await compileWithLinkedAssets(
      '<Figure src="assets/missing.png" />',
      path.join(dir, "disabled.mdx"),
      false
    );
    expect(String(disabled.value)).toContain("assets/missing.png");
    expect(disabled.data.includeDependencies).toBeUndefined();
  });
});

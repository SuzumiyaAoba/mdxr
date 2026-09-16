import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { renderFile } from "../src/render.js";

const tmpDirs: string[] = [];

const makeDir = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rv-test-"));
  tmpDirs.push(dir);
  return dir;
};

describe(renderFile, () => {
  afterAll(async () => {
    await Promise.all(
      tmpDirs.map(async (d) => {
        await rm(d, { force: true, recursive: true });
      })
    );
  });

  it("renders a bare document to standalone html", async () => {
    const dir = await makeDir();
    const file = path.join(dir, "doc.mdx");
    await writeFile(file, "---\ntitle: T\n---\n\n# Hi\n\n:::note\nok\n:::");
    const html = await renderFile(file);
    expect(html).toContain("<!doctype html");
    expect(html).toContain("<title>T</title>");
    expect(html).toContain("Hi");
    // copy buttons are wired by the inlined delegated listener
    expect(html).toContain("[data-copy]");
  });

  it("builds the document header from frontmatter meta fields", async () => {
    const dir = await makeDir();
    const file = path.join(dir, "doc.mdx");
    await writeFile(
      file,
      "---\ntitle: T\nstatus: doing\ndate: 2026-09-16\nowner: alice\nversion: v2\n---\n\nbody"
    );
    const html = await renderFile(file);
    expect(html).toContain("In progress");
    expect(html).toContain("2026-09-16");
    expect(html).toContain("alice");
    expect(html).toContain("v2");
  });

  it("loads project components from rv.config.ts", async () => {
    const dir = await makeDir();
    await writeFile(
      path.join(dir, "rv.config.ts"),
      `export default { components: "./components.tsx" };\n`
    );
    await writeFile(
      path.join(dir, "components.tsx"),
      `export const Badge = ({ label }: { label?: string }) => (
        <span className="rounded bg-emerald-100 px-1">{label}</span>
      );\n`
    );
    const file = path.join(dir, "doc.mdx");
    await writeFile(file, '<Badge label="new" />');
    const html = await renderFile(file);
    expect(html).toContain("new");
    expect(html).toContain("bg-emerald-100");
  });
});

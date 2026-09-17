import { mkdtemp, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { render, renderFile } from "../src/render.js";
import { serveSource } from "../src/serve.js";

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
    // theme toggle is part of the document chrome
    expect(html).toContain('data-rv-theme data-mode="auto"');
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

  it("keeps <Icon> inline in prose", async () => {
    const dir = await makeDir();
    const file = path.join(dir, "doc.mdx");
    await writeFile(file, 'Ship <Icon name="lucide:rocket" /> today.');
    const html = await renderFile(file);
    // The svg stays inside the paragraph…
    expect(html).toMatch(/<p>Ship <svg[^>]*class="iconify/u);
    // …and the compiled CSS keeps it inline (preflight sets svg{display:block}).
    expect(html).toContain(".iconify,.lucide{display:inline-block}");
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

describe(render, () => {
  afterAll(async () => {
    await Promise.all(
      tmpDirs.map(async (d) => {
        await rm(d, { force: true, recursive: true });
      })
    );
  });

  it("renders MDX source passed directly to standalone html", async () => {
    const dir = await makeDir();
    const html = await render(
      "---\ntitle: T\n---\n\n# Hi\n\n:::note\nok\n:::",
      {
        dir,
      }
    );
    expect(html).toContain("<!doctype html");
    expect(html).toContain("<title>T</title>");
    expect(html).toContain("Hi");
  });

  it("loads project components from rv.config.ts in `dir`", async () => {
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
    const html = await render('<Badge label="new" />', { dir });
    expect(html).toContain("new");
    expect(html).toContain("bg-emerald-100");
  });

  it("resolves <CodeFile> relative to `dir` by default", async () => {
    const dir = await makeDir();
    await writeFile(path.join(dir, "sample.ts"), "const alpha = 1;\n");
    const html = await render('<CodeFile path="sample.ts" />', { dir });
    expect(html).toContain("alpha");
    expect(html).toContain("sample.ts");
  });

  it("resolves <CodeFile> relative to `filePath` when given", async () => {
    const configDir = await makeDir();
    const docDir = await makeDir();
    await writeFile(path.join(docDir, "sample.ts"), "const beta = 2;\n");
    const html = await render('<CodeFile path="sample.ts" />', {
      dir: configDir,
      filePath: path.join(docDir, "doc.mdx"),
    });
    expect(html).toContain("beta");
  });
});

const closeServer = (server: Server): void => {
  server.closeAllConnections();
  server.close();
};

const portOf = (server: Server): number => {
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("server is not listening");
  }
  return address.port;
};

describe(serveSource, () => {
  afterAll(async () => {
    await Promise.all(
      tmpDirs.map(async (d) => {
        await rm(d, { force: true, recursive: true });
      })
    );
  });

  it("serves rendered MDX source over http", async () => {
    const dir = await makeDir();
    const server = await serveSource("# Served\n\nbody text", 0, { dir });
    try {
      const res = await fetch(`http://localhost:${portOf(server)}/`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("<!doctype html");
      expect(html).toContain("Served");
      expect(html).toContain("body text");
    } finally {
      closeServer(server);
    }
  });

  it("serves an error page instead of crashing on invalid MDX", async () => {
    const dir = await makeDir();
    const server = await serveSource('import x from "y"\n', 0, { dir });
    try {
      const res = await fetch(`http://localhost:${portOf(server)}/`);
      const html = await res.text();
      expect(html).toContain("rv render error");
      expect(html).toContain("not allowed");
    } finally {
      closeServer(server);
    }
  });
});

import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mdxToAscii } from "../src/ascii/index.js";
import { formatGithubDiagnostic } from "../src/check-github.js";
import { watchDocuments } from "../src/check-watch.js";
import { checkDocument } from "../src/check.js";
import { findConfig, loadConfig } from "../src/config.js";
import {
  captureDependencies,
  dependencyChanges,
} from "../src/dependency-history.js";
import { createDocumentHistory } from "../src/document-history.js";
import { createLibraryIndex } from "../src/library-index.js";
import { renderFile } from "../src/render.js";
import { mergeReviews, parseReviewTransfer } from "../src/review-transfer.js";
import {
  createDocument,
  DOCUMENT_TEMPLATES,
  templateSource,
} from "../src/templates.js";
import { parseWidgetState } from "../src/widget-state.js";

// oxlint-disable-next-line typescript/strict-void-return -- Node's custom promisify signature.
const exec = promisify(execFile);
const CLI = path.resolve("dist/cli.mjs");

describe("document feature workflows", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-features-"));
  });
  afterEach(async () => {
    await rm(dir, { force: true, recursive: true });
  });

  it("discovers project configuration for nested documents and keeps include paths document-relative", async () => {
    const nested = path.join(dir, ".mdxr", "nested");
    await mkdir(nested, { recursive: true });
    await writeFile(path.join(dir, "package.json"), "{}");
    await writeFile(
      path.join(dir, "mdxr.config.ts"),
      'export default { components: "./components.ts", theme: "./theme.css" };'
    );
    await writeFile(
      path.join(dir, "components.ts"),
      'export const ProjectBadge = () => "PROJECT_COMPONENT";'
    );
    await writeFile(
      path.join(dir, "theme.css"),
      ":root { --feature-theme: loaded; }"
    );
    await writeFile(path.join(nested, "part.md"), "DOCUMENT_RELATIVE_INCLUDE");
    const file = path.join(nested, "index.mdx");
    await writeFile(file, '<ProjectBadge />\n\n<Include path="./part.md" />');
    const config = await loadConfig(nested);
    const html = await renderFile(file, { hydrate: false });
    expect({
      componentsPath: config.componentsPath,
      includes: html.includes("DOCUMENT_RELATIVE_INCLUDE"),
      project: html.includes("PROJECT_COMPONENT"),
      theme: html.includes("--feature-theme:loaded"),
    }).toStrictEqual({
      componentsPath: path.join(dir, "components.ts"),
      includes: true,
      project: true,
      theme: true,
    });
    await expect(
      checkDocument(await readFile(file, "utf-8"), file, { render: true })
    ).resolves.toStrictEqual([]);
    await writeFile(
      path.join(nested, "mdxr.config.ts"),
      'export default { components: "./local.ts" };'
    );
    await writeFile(
      path.join(nested, "local.ts"),
      'export const ProjectBadge = () => "LOCAL_COMPONENT";'
    );
    await expect(renderFile(file, { hydrate: false })).resolves.toContain(
      "LOCAL_COMPONENT"
    );
    await expect(
      renderFile(file, {
        config: path.join(dir, "mdxr.config.ts"),
        hydrate: false,
      })
    ).resolves.toContain("PROJECT_COMPONENT");
  });

  it("bounds configuration discovery and never executes configuration during static validation", async () => {
    const nested = path.join(dir, "isolated");
    await mkdir(nested);
    await writeFile(
      path.join(dir, "mdxr.config.ts"),
      'throw new Error("MUST_NOT_EXECUTE");'
    );
    await writeFile(path.join(nested, "package.json"), "{}");
    expect(findConfig(nested)).toBeUndefined();
    expect(findConfig(nested, { project: dir })).toBe(
      path.join(dir, "mdxr.config.ts")
    );
    await expect(
      checkDocument("# Valid", path.join(dir, "doc.mdx"))
    ).resolves.toStrictEqual([]);
  });

  it.each(DOCUMENT_TEMPLATES)(
    "creates a valid %s template without overwriting existing files",
    async (template) => {
      const file = await createDocument({
        dir,
        now: new Date(2026, 9, 2, 13, 4, 5),
        template,
        title: '日本語 "文書"',
      });
      expect(file).toBe(
        path.join(dir, `20261002130405-${template}`, "index.mdx")
      );
      const source = await readFile(file, "utf-8");
      await expect(
        checkDocument(source, file, { render: true })
      ).resolves.toStrictEqual([]);
      const text = await mdxToAscii(source, file);
      expect(text.markdown).toContain("日本語");
      await expect(
        createDocument({ out: file, template })
      ).rejects.toMatchObject({ code: "EEXIST" });
      await expect(readFile(file, "utf-8")).resolves.toBe(source);
    }
  );

  it("generates templates and GitHub diagnostics through the distributed CLI and exposes the typed check API", async () => {
    const file = path.join(dir, "explicit.mdx");
    await exec(process.execPath, [
      CLI,
      "new",
      file,
      "--template",
      "review",
      "--title",
      "CLI review",
    ]);
    await expect(readFile(file, "utf-8")).resolves.toContain(
      'title: "CLI review"'
    );
    const { stdout: templates } = await exec(process.execPath, [
      CLI,
      "templates",
      "--json",
    ]);
    expect(JSON.parse(templates)).toStrictEqual(DOCUMENT_TEMPLATES);
    await writeFile(file, '<Step sttaus="done" />');
    const { stdout } = await exec(process.execPath, [
      CLI,
      "check",
      file,
      "--format",
      "github",
    ]);
    expect(stdout).toContain("::warning file=");
    expect(stdout).toContain("line=1,col=7,title=mdxr%3Aunknown-attribute");
    const api = await import("@suzumiyaaoba/mdxr/check");
    await expect(
      api.checkDocuments(file, { strict: true })
    ).resolves.toMatchObject({ errors: 0, ok: false, warnings: 1 });
  }, 90_000);

  it("escapes workflow properties and diagnostic text so newlines cannot create commands", () => {
    const output = formatGithubDiagnostic({
      code: "code:%,",
      column: 3,
      file: "a,b:c.mdx",
      line: 2,
      message: "bad%\r\n::error::injected",
      severity: "warning",
    });
    expect(output).toBe(
      "::warning file=a%2Cb%3Ac.mdx,line=2,col=3,title=code%3A%25%2C::bad%25%0D%0A::error::injected"
    );
    expect(templateSource("plan", "Title")).toContain("<Reqs>");
  });

  it("watches external include dependencies and updates library diagnostics after dependencies change", async () => {
    const docs = path.join(dir, "docs");
    await mkdir(docs);
    const dependency = path.join(dir, "part.md");
    await writeFile(dependency, "# Part");
    const file = path.join(docs, "doc.mdx");
    await writeFile(file, '<Include path="../part.md" />');
    const results: number[] = [];
    const watcher = await watchDocuments(docs, {}, (result) => {
      results.push(result.errors);
    });
    try {
      const index = await createLibraryIndex(docs);
      const before = await index.search();
      expect(before.results[0]?.diagnostics ?? []).toStrictEqual([]);
      await rm(dependency);
      await vi.waitFor(() => {
        expect(results.at(-1)).toBeGreaterThan(0);
      });
      const after = await index.search();
      expect(after.results[0]?.diagnostics).toStrictEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "mdxr:local-reference" }),
        ])
      );
      await writeFile(dependency, "# Restored");
      await vi.waitFor(() => {
        expect(results.at(-1)).toBe(0);
      });
    } finally {
      watcher.close();
    }
  });

  it("captures a dependency-only version and reports changed or missing dependency hashes", async () => {
    const file = path.join(dir, "doc.mdx");
    await writeFile(file, "# Same source");
    const dependency = path.join(dir, "part.md");
    await writeFile(dependency, "first");
    const history = createDocumentHistory(file, dir);
    const legacy = await history.capture("initial");
    expect(legacy.dependencies).toBeUndefined();
    const first = await history.capture("initial", [dependency]);
    await writeFile(dependency, "second");
    const second = await history.capture("change", [dependency]);
    expect({
      sameSource: second.contentHash === first.contentHash,
      savedDependencyChange: second.id !== first.id,
    }).toStrictEqual({ sameSource: true, savedDependencyChange: true });
    const changed = await history.dependencies?.(first.id);
    expect(changed?.changes[0]?.status).toBe("changed");
    await rm(dependency);
    const missing = await history.dependencies?.(second.id);
    const next = await history.capture("before-instruction");
    expect({
      preservedPaths: next.dependencies?.map((entry) => entry.path),
      status: missing?.changes[0]?.status,
    }).toStrictEqual({ preservedPaths: ["part.md"], status: "missing" });
    const versions = await history.list();
    expect(versions.versions).toHaveLength(4);
  });

  it("deduplicates dependency aliases and compares previously captured aliases against the same file", async () => {
    const file = path.join(dir, "part.md");
    const alias = path.join(dir, "alias.md");
    await writeFile(file, "first");
    await symlink(file, alias);
    const captured = await captureDependencies([file, alias], dir);
    expect(captured.map(({ path: filePath }) => filePath)).toStrictEqual([
      "part.md",
    ]);
    const [entry] = captured;
    if (entry === undefined) {
      throw new Error("Missing dependency capture");
    }
    await writeFile(file, "second");
    const changes = await dependencyChanges(
      [{ ...entry, path: "alias.md" }],
      dir
    );
    expect(
      changes.map(({ capturedHash, status }) => ({ capturedHash, status }))
    ).toStrictEqual([{ capturedHash: entry.hash, status: "changed" }]);
  });

  it("validates review exchanges, merges idempotently and retains conflicts by default", () => {
    const record = {
      anchor: {
        end: 4,
        heading: "Design",
        image: "",
        kind: "text",
        path: [0],
        prefix: "",
        quote: "text",
        revision: "old",
        start: 0,
        suffix: "",
      },
      comment: "Original",
      id: "comment-1",
    };
    const raw = JSON.stringify({
      annotations: { annotations: [record], history: [] },
      document: {
        file: "old.mdx",
        id: "stable-id",
        revision: "old",
        title: "Review",
      },
      exportedAt: "2026-10-02T00:00:00.000Z",
      format: "mdxr-review",
      sections: [],
      version: 1,
    });
    const transfer = parseReviewTransfer(raw);
    const local = { annotations: [], history: [] };
    const first = mergeReviews(local, transfer.annotations);
    expect(first.added).toBe(1);
    expect(mergeReviews(first.store, transfer.annotations)).toMatchObject({
      added: 0,
      conflicts: 0,
    });
    const changed = structuredClone(transfer.annotations);
    const [incoming] = changed.annotations;
    if (incoming === undefined) {
      throw new Error("Expected imported comment");
    }
    incoming.comment = "Incoming";
    expect({
      incoming: mergeReviews(first.store, changed, true).store.annotations[0]
        ?.comment,
      local: mergeReviews(first.store, changed).store.annotations[0]?.comment,
    }).toStrictEqual({ incoming: "Incoming", local: "Original" });
    expect(() =>
      parseReviewTransfer(raw.replace('"version":1', '"version":9'))
    ).toThrow("unsupported");
    expect(() => parseWidgetState('{"version":1,"records":[{}]}')).toThrow(
      "Invalid"
    );
  });
});

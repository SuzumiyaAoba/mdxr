import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createLibraryIndex } from "../src/library-index.js";

describe("local document library index", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "mdxr-library-"));
  });

  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
  });

  it("indexes Markdown and MDX metadata without rendering or running code", async () => {
    await mkdir(path.join(root, "plans"), { recursive: true });
    await writeFile(
      path.join(root, "plans", "auth.mdx"),
      [
        "---",
        "title: 認証計画",
        "status: doing",
        "---",
        "",
        "# 見出しはタイトルより下位",
        "",
        "認証**機能**を追加する。",
        '<Step title="日本語検索" />',
        'export const dangerous = (() => { throw new Error("must not run"); })();',
        "",
      ].join("\n")
    );
    await writeFile(
      path.join(root, "design.markdown"),
      "# 設計2\n\n日本[語](https://example.test)検索を使う。\n"
    );
    await writeFile(path.join(root, "readme.md"), "# README\n\n概要です。\n");

    const index = await createLibraryIndex(root);
    const response = await index.search();
    const auth = response.results.find(({ id }) => id === "plans/auth.mdx");
    const authStats = await stat(path.join(root, "plans", "auth.mdx"), {
      bigint: true,
    });
    const expectedMtime = authStats.mtime;

    expect({
      count: response.total,
      mtime: auth?.updatedAt,
      status: auth?.status,
      statuses: response.statuses,
      title: auth?.title,
    }).toStrictEqual({
      count: 3,
      mtime: expectedMtime.toISOString(),
      status: "doing",
      statuses: ["doing"],
      title: "認証計画",
    });
    await expect(
      index
        .search({ query: "日本語検索" })
        .then(({ results }) => results.map(({ id }) => id))
    ).resolves.toContain("plans/auth.mdx");
  });

  it("joins Japanese text split by inline Markdown and indexes literal MDX labels", async () => {
    await writeFile(
      path.join(root, "inline.mdx"),
      "# インライン例\n\n認証**機能**を追加し、日本[語](https://example.test)検索を有効にする。\n"
    );
    await writeFile(
      path.join(root, "step.mdx"),
      '<Step title="日本語検索" label="認証機能" />\n'
    );

    const index = await createLibraryIndex(root);
    const authentication = await index.search({ query: "認証機能" });
    const japanese = await index.search({ query: "日本語検索" });

    expect(authentication.results.map(({ id }) => id)).toContain("inline.mdx");
    expect(authentication.results.map(({ id }) => id)).toContain("step.mdx");
    expect(japanese.results.map(({ id }) => id)).toContain("inline.mdx");
    expect(japanese.results.map(({ id }) => id)).toContain("step.mdx");
    expect(
      authentication.results.find(({ id }) => id === "inline.mdx")?.excerpt
    ).toContain("認証機能");
  });

  it("uses the first heading when metadata has no title", async () => {
    await writeFile(path.join(root, "overview.md"), "# Overview\n\nText.\n");
    const index = await createLibraryIndex(root);

    await expect(index.search()).resolves.toMatchObject({
      results: [{ title: "Overview" }],
      total: 1,
    });
  });

  it("skips excluded folders, symlinks, and .mdxr history", async () => {
    const paths = [
      ".git/secret.mdx",
      ".mdxr-cache/secret.mdx",
      ".mdxr/history/old.mdx",
      "dist/secret.mdx",
      "node_modules/pkg/secret.mdx",
      "storybook-static/secret.mdx",
      "target/real.mdx",
      "visible.mdx",
    ];
    await Promise.all(
      paths.map(async (relativePath) => {
        const filePath = path.join(root, relativePath);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, `# ${relativePath}\n`);
      })
    );
    await symlink(path.join(root, "target"), path.join(root, "linked"));
    await symlink(
      path.join(root, "target", "real.mdx"),
      path.join(root, "linked-file.mdx")
    );

    const index = await createLibraryIndex(root);
    const result = await index.search({ sort: "title" });

    expect(result.results.map(({ id }) => id)).toStrictEqual([
      "target/real.mdx",
      "visible.mdx",
    ]);

    const hiddenRoot = path.join(root, "project", ".mdxr");
    await mkdir(path.join(hiddenRoot, "history"), { recursive: true });
    await writeFile(path.join(hiddenRoot, "history", "old.mdx"), "# Old\n");
    await writeFile(path.join(hiddenRoot, "current.mdx"), "# Current\n");
    const hiddenIndex = await createLibraryIndex(hiddenRoot);
    await expect(hiddenIndex.search()).resolves.toMatchObject({
      results: [{ id: "current.mdx" }],
      total: 1,
    });
  });

  it("keeps indexing siblings when YAML metadata is invalid", async () => {
    await writeFile(
      path.join(root, "broken.mdx"),
      "---\ntitle: [unclosed\n---\n\n# Fallback\n\n日本語検索の本文です。\n"
    );
    await writeFile(path.join(root, "good.md"), "# Good\n\nOther text.\n");

    const index = await createLibraryIndex(root);
    const response = await index.search({ query: "日本語検索" });

    expect(response.results.map(({ id }) => id)).toStrictEqual(["broken.mdx"]);
    expect(response.results[0]?.title).toBe("Fallback");
    expect(response.warnings).toContainEqual({
      path: "broken.mdx",
      reason: "parse",
    });
    expect(response.total).toBe(2);
  });

  it("tracks additions, edits, and deletions on later searches", async () => {
    const filePath = path.join(root, "change.mdx");
    await writeFile(filePath, "# Changed\n\n古い本文。\n");
    const index = await createLibraryIndex(root);

    const initialSearch = await index.search({ query: "古い本文" });
    expect(initialSearch.matched).toBe(1);
    await writeFile(filePath, "# Changed\n\n新しい本文。\n");
    await writeFile(path.join(root, "added.md"), "# Added\n\n追加文書。\n");
    const editedSearch = await index.search({ query: "新しい本文" });
    expect(editedSearch.matched).toBe(1);
    const addedSearch = await index.search();
    expect(addedSearch.total).toBe(2);

    await rm(filePath);
    const deletedSearch = await index.search();
    expect(deletedSearch.results.map(({ id }) => id)).toStrictEqual([
      "added.md",
    ]);
  });

  it("removes only an indexed document and keeps assets and parent folders", async () => {
    const directory = path.join(root, "notes", "plans");
    const documentPath = path.join(directory, "remove.mdx");
    const siblingPath = path.join(directory, "keep.md");
    const assetPath = path.join(directory, "diagram.svg");
    await mkdir(directory, { recursive: true });
    await writeFile(documentPath, "# Remove\n");
    await writeFile(siblingPath, "# Keep\n");
    await writeFile(assetPath, "<svg />\n");
    const index = await createLibraryIndex(root);

    const [snapshot, removal] = await Promise.all([
      index.search(),
      index.remove("notes/plans/remove.mdx"),
    ]);
    const remaining = await index.search();
    const assetExists = await stat(assetPath).then((stats) => stats.isFile());
    const folderExists = await stat(directory).then((stats) =>
      stats.isDirectory()
    );
    const removedFileExists = await lstat(documentPath)
      .then(() => false)
      .catch(() => true);
    const siblingExists = await stat(siblingPath).then((stats) =>
      stats.isFile()
    );

    expect({
      asset: assetExists,
      folder: folderExists,
      remainingIds: remaining.results.map(({ id }) => id),
      removed: removal.status,
      removedFile: removedFileExists,
      sibling: siblingExists,
      snapshotTotal: snapshot.total,
    }).toStrictEqual({
      asset: true,
      folder: true,
      remainingIds: ["notes/plans/keep.md"],
      removed: "deleted",
      removedFile: true,
      sibling: true,
      snapshotTotal: 2,
    });
  });

  it("rejects unsafe deletion IDs, symlinks, directories, and unindexed files", async () => {
    const libraryRoot = path.join(root, "library");
    const outsidePath = path.join(root, "outside.mdx");
    const linkedPath = path.join(libraryRoot, "linked.mdx");
    const directoryPath = path.join(libraryRoot, "folder");
    const assetPath = path.join(libraryRoot, "assets", "image.svg");
    await mkdir(path.dirname(assetPath), { recursive: true });
    await mkdir(directoryPath);
    await writeFile(outsidePath, "# Outside\n");
    await writeFile(assetPath, "<svg />\n");
    await symlink(outsidePath, linkedPath);
    const index = await createLibraryIndex(libraryRoot);
    const asset = await index.remove("assets/image.svg");
    const assetExists = await stat(assetPath).then((stats) => stats.isFile());
    const directory = await index.remove("folder");
    const missing = await index.remove("missing.mdx");
    const outsideExists = await stat(outsidePath).then((stats) =>
      stats.isFile()
    );
    const parent = await index.remove("../outside.mdx");
    const rootResult = await index.remove("");
    const symlinkResult = await index.remove("linked.mdx");
    const symlinkExists = await lstat(linkedPath)
      .then((stats) => stats.isSymbolicLink())
      .catch(() => false);

    expect({
      asset: asset.status,
      assetExists,
      directory: directory.status,
      missing: missing.status,
      outsideExists,
      parent: parent.status,
      root: rootResult.status,
      symlink: symlinkResult.status,
      symlinkExists,
    }).toStrictEqual({
      asset: "not-found",
      assetExists: true,
      directory: "invalid",
      missing: "not-found",
      outsideExists: true,
      parent: "invalid",
      root: "invalid",
      symlink: "invalid",
      symlinkExists: true,
    });
  });

  it("resolves only indexed regular files and rejects path replacement", async () => {
    const safeFile = path.join(root, "safe.mdx");
    const otherFile = path.join(root, "other.mdx");
    await writeFile(safeFile, "# Safe\n");
    await writeFile(otherFile, "# Other\n");
    const index = await createLibraryIndex(root);

    await expect(index.resolve("safe.mdx")).resolves.toBe(
      await realpath(safeFile)
    );
    await expect(index.resolve("../outside.mdx")).resolves.toBeUndefined();
    await expect(index.resolve("not-indexed.mdx")).resolves.toBeUndefined();

    await unlink(safeFile);
    await symlink(otherFile, safeFile);
    await expect(index.resolve("safe.mdx")).resolves.toBeUndefined();
    const safeStats = await lstat(safeFile);
    expect(safeStats.isSymbolicLink()).toBeTruthy();
  });

  it("rejects resolving and deleting an indexed path whose parent becomes a symlink", async () => {
    const libraryRoot = path.join(root, "library");
    const notes = path.join(libraryRoot, "notes");
    const retained = path.join(libraryRoot, "retained");
    const outside = path.join(root, "outside");
    await mkdir(notes, { recursive: true });
    await mkdir(outside);
    await writeFile(path.join(notes, "plan.mdx"), "# Indexed plan\n");
    await writeFile(path.join(outside, "plan.mdx"), "# Outside plan\n");
    const index = await createLibraryIndex(libraryRoot);
    await index.search();

    await rename(notes, retained);
    await symlink(outside, notes);

    await expect(index.resolve("notes/plan.mdx")).resolves.toBeUndefined();
    await expect(index.remove("notes/plan.mdx")).resolves.toStrictEqual({
      status: "invalid",
    });
    await expect(
      readFile(path.join(outside, "plan.mdx"), "utf-8")
    ).resolves.toBe("# Outside plan\n");
    await expect(
      readFile(path.join(retained, "plan.mdx"), "utf-8")
    ).resolves.toBe("# Indexed plan\n");
  });

  it("rejects a missing or non-directory root", async () => {
    const filePath = path.join(root, "file.md");
    await writeFile(filePath, "# File\n");

    await expect(
      createLibraryIndex(path.join(root, "missing"))
    ).rejects.toThrow("Document library root does not exist");
    await expect(createLibraryIndex(filePath)).rejects.toThrow(
      "Document library root is not a directory"
    );
  });
});

import { describe, expect, it } from "vitest";

import { parseDiff } from "../src/ui/diff.js";

describe(parseDiff, () => {
  it("splits a git diff into per-file structures", () => {
    const files = parseDiff(
      [
        "diff --git a/src/a.ts b/src/a.ts",
        "index 111..222 100644",
        "--- a/src/a.ts",
        "+++ b/src/a.ts",
        "@@ -1,2 +1,2 @@",
        "-old",
        "+new",
        " context",
        "diff --git a/src/b.ts b/src/b.ts",
        "--- a/src/b.ts",
        "+++ b/src/b.ts",
        "@@ -5 +5 @@",
        "-x",
        "+y",
      ].join("\n")
    );
    expect(files).toHaveLength(2);
    expect(files[0]).toMatchObject({
      adds: 1,
      dels: 1,
      newPath: "src/a.ts",
      oldPath: "src/a.ts",
    });
    expect(files[0]?.meta).toContain("index 111..222 100644");
    expect(files[1]?.newPath).toBe("src/b.ts");
  });

  it("tracks old and new line numbers across rows", () => {
    const [f] = parseDiff(
      [
        "--- a/x.ts",
        "+++ b/x.ts",
        "@@ -10,3 +10,3 @@",
        " keep",
        "-gone",
        "+here",
      ].join("\n")
    );
    const rows = f?.hunks[0]?.rows ?? [];
    expect(rows[0]).toMatchObject({ kind: "ctx", newLine: 10, oldLine: 10 });
    expect(rows[1]).toMatchObject({ kind: "del", oldLine: 11 });
    expect(rows[2]).toMatchObject({ kind: "add", newLine: 11 });
  });

  it("treats a lone - line inside a hunk as content, not a file header", () => {
    const [f] = parseDiff(
      [
        "--- a/x.md",
        "+++ b/x.md",
        "@@ -1,2 +1,2 @@",
        "- - not a header",
        "+ - still",
      ].join("\n")
    );
    const rows = f?.hunks[0]?.rows ?? [];
    expect(rows[0]?.kind).toBe("del");
    expect(rows[0]?.text).toBe(" - not a header");
    expect(rows[1]?.kind).toBe("add");
  });

  it("detects new and deleted files via /dev/null", () => {
    const [added] = parseDiff(
      ["--- /dev/null", "+++ b/new.ts", "@@ -0,0 +1 @@", "+x"].join("\n")
    );
    expect(added?.oldPath).toBeUndefined();
    expect(added?.newPath).toBe("new.ts");
    const [gone] = parseDiff(
      ["--- a/old.ts", "+++ /dev/null", "@@ -1 +0,0 @@", "-x"].join("\n")
    );
    expect(gone?.oldPath).toBe("old.ts");
    expect(gone?.newPath).toBeUndefined();
  });

  it("detects renames from rename from/to meta lines", () => {
    const [f] = parseDiff(
      [
        "diff --git a/old.ts b/new.ts",
        "similarity index 90%",
        "rename from old.ts",
        "rename to new.ts",
      ].join("\n")
    );
    expect(f?.oldPath).toBe("old.ts");
    expect(f?.newPath).toBe("new.ts");
    expect(f?.meta).toContain("similarity index 90%");
  });

  it("collects bare +/- streams into an implicit hunk", () => {
    const files = parseDiff("+added line\n-removed line\n plain");
    expect(files).toHaveLength(1);
    const [f] = files;
    expect(f?.adds).toBe(1);
    expect(f?.dels).toBe(1);
    expect(f?.hunks[0]?.rows.map((r) => r.kind)).toStrictEqual([
      "add",
      "del",
      "ctx",
    ]);
  });

  it("does not number rows in an implicit hunk after a counted one", () => {
    // The counted hunk closes on +b; the trailing bare rows open an implicit
    // hunk. Its rows must not inherit the previous hunk's stale line counters.
    const [f] = parseDiff(
      [
        "--- a/x.ts",
        "+++ b/x.ts",
        "@@ -1 +1 @@",
        "-a",
        "+b",
        "+extra",
        " ctx",
      ].join("\n")
    );
    const [counted, implicit] = f?.hunks ?? [];
    expect(counted?.rows[1]).toMatchObject({ kind: "add", newLine: 1 });
    expect(implicit?.rows.map((r) => r.kind)).toStrictEqual(["add", "ctx"]);
    expect(implicit?.rows[0]?.newLine).toBeUndefined();
    expect(implicit?.rows[1]?.oldLine).toBeUndefined();
    expect(implicit?.rows[1]?.newLine).toBeUndefined();
  });

  it("keeps \\ No newline markers as note rows", () => {
    const [f] = parseDiff(
      [
        "--- a/x.ts",
        "+++ b/x.ts",
        "@@ -1 +1 @@",
        "-a",
        "\\ No newline at end of file",
        "+b",
      ].join("\n")
    );
    const note = f?.hunks[0]?.rows.find((r) => r.kind === "note");
    expect(note?.text).toContain("No newline");
  });

  it("treats ---/+++ lines inside a counted hunk as content, not headers", () => {
    // Deleting `--- old` and adding `+++ new` inside a hunk emits lines that
    // look exactly like file headers; the @@ counts prove they're content.
    const files = parseDiff(
      [
        "--- a/x.md",
        "+++ b/x.md",
        "@@ -1,2 +1,2 @@",
        "--- old: true",
        "+++ new: true",
      ].join("\n")
    );
    expect(files).toHaveLength(1);
    const rows = files[0]?.hunks[0]?.rows ?? [];
    expect(rows.map((r) => r.kind)).toStrictEqual(["del", "add"]);
    expect(rows[0]?.text).toBe("-- old: true");
    expect(rows[1]?.text).toBe("++ new: true");
  });

  it("keeps a \\ note line after a counted hunk exhausts its tallies", () => {
    // Counters close the hunk on `+b`, but the trailing `\` line still
    // belongs inside it — it annotates the previous row, not file meta.
    const [f] = parseDiff(
      [
        "--- a/x.ts",
        "+++ b/x.ts",
        "@@ -1 +1 @@",
        "-a",
        "+b",
        "\\ No newline at end of file",
      ].join("\n")
    );
    const last = f?.hunks[0]?.rows.at(-1);
    expect(last?.kind).toBe("note");
    expect(last?.text).toContain("No newline");
    expect(f?.meta).toHaveLength(0);
  });

  it("honours zero-count hunks (pure additions / deletions)", () => {
    const [added] = parseDiff(
      ["--- /dev/null", "+++ b/n.ts", "@@ -0,0 +1,2 @@", "+x", "+y"].join("\n")
    );
    expect(added?.hunks[0]?.rows.map((r) => r.kind)).toStrictEqual([
      "add",
      "add",
    ]);
    expect(added?.adds).toBe(2);
  });

  it("returns no file entries for empty input", () => {
    expect(parseDiff("")).toStrictEqual([]);
    expect(parseDiff("\n\n")).toStrictEqual([]);
  });

  it("does not split a file on 'diff --git' text mid-line", () => {
    // A meta/comment line mentioning the header phrase must not open a file.
    const [f] = parseDiff(
      [
        "--- a/x.ts",
        "+++ b/x.ts",
        "@@ -1 +1 @@",
        "-a",
        "+b",
        "note: use diff --git a/x b/y to compare",
      ].join("\n")
    );
    expect(f?.meta.some((m) => m.includes("diff --git"))).toBeTruthy();
  });

  it("normalizes CRLF input", () => {
    const [f] = parseDiff(
      "--- a/x.ts\r\n+++ b/x.ts\r\n@@ -1 +1 @@\r\n-a\r\n+b\r\n"
    );
    expect(f?.newPath).toBe("x.ts");
    const rows = f?.hunks[0]?.rows ?? [];
    expect(rows.map((r) => r.kind)).toStrictEqual(["del", "add"]);
    expect(rows[1]?.text).toBe("b");
  });

  it("starts a new file when --- appears after content without diff --git", () => {
    const files = parseDiff(
      [
        "--- a/one.ts",
        "+++ b/one.ts",
        "@@ -1 +1 @@",
        "-x",
        "+y",
        "--- a/two.ts",
        "+++ b/two.ts",
        "@@ -1 +1 @@",
        "-p",
        "+q",
      ].join("\n")
    );
    expect(files).toHaveLength(2);
    expect(files[1]?.newPath).toBe("two.ts");
  });
});

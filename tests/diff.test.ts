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

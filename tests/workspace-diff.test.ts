import { describe, expect, it } from "vitest";

import {
  createSplitDiffRows,
  createUnifiedDiffRows,
  createWordDiff,
} from "../src/workspace-diff-model.js";
import type { DiffLine } from "../src/workspace-diff-model.js";

describe("workspace diff model", () => {
  it("tracks both line numbers in unified rows", () => {
    const lines: DiffLine[] = [
      { text: "first", type: "context" },
      { text: "old", type: "remove" },
      { text: "new", type: "add" },
      { text: "last", type: "context" },
    ];

    expect(
      createUnifiedDiffRows(lines, false).map((row) => [
        row.oldNumber,
        row.newNumber,
        row.type,
      ])
    ).toStrictEqual([
      [1, 1, "context"],
      [2, null, "remove"],
      [null, 2, "add"],
      [3, 3, "context"],
    ]);
  });

  it("aligns changed lines and leaves unmatched old lines empty", () => {
    const rows = createSplitDiffRows(
      [
        { text: "before", type: "context" },
        { text: "old one", type: "remove" },
        { text: "old two", type: "remove" },
        { text: "new", type: "add" },
        { text: "after", type: "context" },
      ],
      false
    );

    expect(
      rows.map((row) => [
        row.oldLine?.lineNumber ?? null,
        row.newLine?.lineNumber ?? null,
        row.oldLine?.kind ?? null,
        row.newLine?.kind ?? null,
      ])
    ).toStrictEqual([
      [1, 1, "context", "context"],
      [2, 2, "remove", "add"],
      [3, null, "remove", null],
      [4, 3, "context", "context"],
    ]);
  });

  it("keeps row keys unique across multiple change groups", () => {
    const rows = createSplitDiffRows(
      [
        { text: "old one", type: "remove" },
        { text: "new one", type: "add" },
        { text: "kept", type: "context" },
        { text: "old two", type: "remove" },
        { text: "new two", type: "add" },
      ],
      false
    );

    expect(new Set(rows.map(({ key }) => key)).size).toBe(rows.length);
  });

  it("supports additions and deletions on one side only", () => {
    const added = createSplitDiffRows(
      [
        { text: "new one", type: "add" },
        { text: "new two", type: "add" },
      ],
      false
    );
    const removed = createSplitDiffRows(
      [
        { text: "old one", type: "remove" },
        { text: "old two", type: "remove" },
      ],
      false
    );

    expect(
      added.map((row) => [row.oldLine, row.newLine?.lineNumber])
    ).toStrictEqual([
      [null, 1],
      [null, 2],
    ]);
    expect(
      removed.map((row) => [row.oldLine?.lineNumber, row.newLine])
    ).toStrictEqual([
      [1, null],
      [2, null],
    ]);
  });

  it("marks changed English words while retaining shared text", () => {
    const result = createWordDiff(
      'const title = "old name";',
      'const title = "new name";'
    );

    const beforeText = result.before.map(({ text }) => text).join("");
    const afterText = result.after.map(({ text }) => text).join("");
    const removedOldWord = result.before.some(
      ({ kind, text }) => kind === "remove" && text.includes("old")
    );
    const addedNewWord = result.after.some(
      ({ kind, text }) => kind === "add" && text.includes("new")
    );

    expect([beforeText, afterText, removedOldWord, addedNewWord]).toStrictEqual(
      ['const title = "old name";', 'const title = "new name";', true, true]
    );
  });

  it("uses Japanese word boundaries for inline changes", () => {
    const result = createWordDiff("内容を確認します", "内容を更新します");

    expect(result.before.map(({ text }) => text).join("")).toBe(
      "内容を確認します"
    );
    expect(result.after.map(({ text }) => text).join("")).toBe(
      "内容を更新します"
    );
    expect(result.before.find(({ kind }) => kind === "remove")?.text).toContain(
      "確認"
    );
    expect(result.after.find(({ kind }) => kind === "add")?.text).toContain(
      "更新"
    );
  });

  it("bounds inline work for very long changed lines", () => {
    const beforeText = `before ${"a".repeat(5000)}`;
    const afterText = `after ${"b".repeat(5000)}`;
    const result = createWordDiff(beforeText, afterText);

    expect(result.before).toStrictEqual([{ kind: "remove", text: beforeText }]);
    expect(result.after).toStrictEqual([{ kind: "add", text: afterText }]);
  });
});

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DocumentDiffLine } from "../src/document-history.js";
import { createDocumentHistory } from "../src/document-history.js";

const reconstructAfter = (
  before: string,
  diff: DocumentDiffLine[]
): string | undefined => {
  const beforeLines = before.replaceAll("\r\n", "\n").split("\n");
  const afterLines: string[] = [];
  let cursor = 0;
  for (const line of diff) {
    if (line.type === "add") {
      afterLines.push(line.text);
      continue;
    }
    if (beforeLines[cursor] !== line.text) {
      return undefined;
    }
    if (line.type === "context") {
      afterLines.push(line.text);
    }
    cursor += 1;
  }
  return cursor === beforeLines.length ? afterLines.join("\n") : undefined;
};

const DIFF_CASES = [
  { after: "first\nfirst\r\nlast\n", before: "", name: "empty input" },
  {
    after: "same\nmiddle\r\nsame",
    before: "same\r\nsame\nend\n",
    name: "repeated lines and mixed endings",
  },
  {
    after: "replacement",
    before: "before one\nbefore two",
    name: "full replacement",
  },
] as const;

describe("document history", () => {
  let root: string;
  let sourcePath: string;
  let history: ReturnType<typeof createDocumentHistory>;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "mdxr-history-"));
    sourcePath = path.join(root, "report.mdx");
    await writeFile(sourcePath, "# Report\nold\nkeep", "utf-8");
    history = createDocumentHistory(sourcePath, root);
  });

  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
  });

  it("stores unique events while sharing content blobs and suppressing repeated changes", async () => {
    const initial = await history.capture("initial");
    const repeatedInitial = await history.capture("initial");
    const beforeInstruction = await history.capture("before-instruction");
    const duplicateChange = await history.capture("change");

    expect({
      beforeInstructionIsNew: beforeInstruction.id !== initial.id,
      contentHash: beforeInstruction.contentHash,
      repeatedInitialId: repeatedInitial.id,
    }).toStrictEqual({
      beforeInstructionIsNew: true,
      contentHash: initial.contentHash,
      repeatedInitialId: initial.id,
    });
    expect(duplicateChange.id).toBe(beforeInstruction.id);

    await writeFile(sourcePath, "# Report\nnew\nkeep", "utf-8");
    const changed = await history.capture("change");
    const duplicateChanged = await history.capture("change");
    expect(duplicateChanged.id).toBe(changed.id);

    const versions = await history.list();
    expect({
      ids: versions.versions.map(({ id }) => id),
      kinds: versions.versions.map(({ kind }) => kind),
      latestId: versions.latestId,
    }).toStrictEqual({
      ids: [initial.id, beforeInstruction.id, changed.id],
      kinds: ["initial", "before-instruction", "change"],
      latestId: changed.id,
    });
  });

  it("keeps snapshots readable after later source edits", async () => {
    const before = await history.capture("initial");
    await writeFile(sourcePath, "# Report\nnew\nkeep", "utf-8");
    const after = await history.capture("change");

    await expect(
      Promise.all([history.read(before.id), history.read(after.id)])
    ).resolves.toStrictEqual(["# Report\nold\nkeep", "# Report\nnew\nkeep"]);
  });

  it("records a new event when content returns to an earlier version", async () => {
    const first = await history.capture("initial");
    await writeFile(sourcePath, "# Report\nnew\nkeep", "utf-8");
    const second = await history.capture("change");
    await writeFile(sourcePath, "# Report\nold\nkeep", "utf-8");
    const restored = await history.capture("change");

    expect(restored.id).not.toBe(first.id);
    expect(restored.contentHash).toBe(first.contentHash);
    const versions = await history.list();
    expect(versions.versions.map(({ id }) => id)).toStrictEqual([
      first.id,
      second.id,
      restored.id,
    ]);
  });

  it("returns local line changes between event IDs", async () => {
    const before = await history.capture("initial");
    await writeFile(sourcePath, "# Report\nnew\nkeep", "utf-8");
    const after = await history.capture("change");

    await expect(history.diff(before.id, after.id)).resolves.toStrictEqual({
      lines: [
        { text: "# Report", type: "context" },
        { text: "old", type: "remove" },
        { text: "new", type: "add" },
        { text: "keep", type: "context" },
      ],
    });
    await expect(history.diff(before.id, before.id)).resolves.toStrictEqual({
      lines: [
        { text: "# Report", type: "context" },
        { text: "old", type: "context" },
        { text: "keep", type: "context" },
      ],
    });
  });

  it.each(DIFF_CASES)("reconstructs $name diffs", async ({ before, after }) => {
    await writeFile(sourcePath, before, "utf-8");
    const beforeVersion = await history.capture("before-instruction");
    await writeFile(sourcePath, after, "utf-8");
    const afterVersion = await history.capture("change");
    const result = await history.diff(beforeVersion.id, afterVersion.id);

    expect(reconstructAfter(before, result.lines)).toBe(
      after.replaceAll("\r\n", "\n")
    );
  });

  it("serializes concurrent captures from multiple preview instances", async () => {
    const firstHistory = createDocumentHistory(sourcePath, root);
    const secondHistory = createDocumentHistory(sourcePath, root);
    const [first, second] = await Promise.all([
      firstHistory.capture("change"),
      secondHistory.capture("change"),
    ]);

    expect(first.id).toBe(second.id);
    const versions = await history.list();
    expect(versions.versions).toHaveLength(1);
  });

  it("keeps snapshot bytes stable after the original source changes", async () => {
    const before = await history.capture("initial");
    await writeFile(sourcePath, "replaced", "utf-8");

    await expect(readFile(sourcePath, "utf-8")).resolves.toBe("replaced");
    await expect(history.read(before.id)).resolves.toBe("# Report\nold\nkeep");
  });

  it("distinguishes malformed IDs from missing versions", async () => {
    await expect(history.read("not-an-id")).rejects.toMatchObject({
      kind: "invalid-version",
    });
    await expect(
      history.read("00000000-0000-4000-8000-000000000000")
    ).rejects.toMatchObject({
      kind: "unknown-version",
    });
  });

  it("resolves uppercase UUIDs to the same stored version", async () => {
    const version = await history.capture("initial");

    await expect(history.read(version.id.toUpperCase())).resolves.toBe(
      "# Report\nold\nkeep"
    );
  });
});

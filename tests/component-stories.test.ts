import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { EXTENDED_FEATURES } from "../src/extended/catalog.js";

const storyMeta = (source: ts.SourceFile): Map<string, string> => {
  const values = new Map<string, string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === "meta"
    ) {
      const { initializer } = node;
      const object =
        initializer && ts.isSatisfiesExpression(initializer)
          ? initializer.expression
          : initializer;
      if (object && ts.isObjectLiteralExpression(object)) {
        for (const prop of object.properties) {
          if (!ts.isPropertyAssignment(prop)) {
            continue;
          }
          const value = prop.initializer;
          if (ts.isStringLiteral(value) || ts.isIdentifier(value)) {
            values.set(prop.name.getText(source), value.text);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return values;
};

describe("extended component stories", () => {
  it("registers an individual component story for every extended public component", async () => {
    const directory = path.resolve("stories/extended");
    const directoryEntries = await readdir(directory);
    const files = directoryEntries.filter((file) =>
      file.endsWith(".stories.tsx")
    );
    const entries = await Promise.all(
      files.map(async (file) => {
        const text = await readFile(path.join(directory, file), "utf-8");
        const source = ts.createSourceFile(
          file,
          text,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX
        );
        return { meta: storyMeta(source), text };
      })
    );
    const expected = [
      ...EXTENDED_FEATURES.flatMap((feature) => feature.components),
      "RecordItem",
    ].toSorted((a, b) => a.localeCompare(b));
    expect(
      entries
        .map(({ meta }) => meta.get("component") ?? "")
        .toSorted((a, b) => a.localeCompare(b))
    ).toStrictEqual(expected);
    for (const { meta, text } of entries) {
      expect(meta.get("title")).toBe(`Components/${meta.get("component")}`);
      expect(text).toMatch(/export const Default:\s*Story\s*=/u);
      expect(text).toContain("export default meta");
    }
  });
});

import { readFile } from "node:fs/promises";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { mdxToAscii } from "../src/ascii/index.js";
import { render } from "../src/render.js";
import registry from "../src/wireframe/registry.json";
import examples from "./fixtures/wireframe-catalog.json";
import { renderDoc } from "./helpers.js";

describe("complete wireframe-ui registry", () => {
  it("covers the pinned 45 UI families and nine blocks, including every component export", async () => {
    expect(registry.families.filter(({ kind }) => kind === "ui")).toHaveLength(
      45
    );
    expect(
      registry.families.filter(({ kind }) => kind === "block")
    ).toHaveLength(9);
    expect(examples.map(({ family }) => family).toSorted()).toStrictEqual(
      registry.families.map(({ name }) => name).toSorted()
    );
    const actual = await Promise.all(
      registry.families.map(async (family) => {
        const path = `src/components/wireframe/${family.kind === "ui" ? "ui" : "blocks"}/${family.name}.tsx`;
        const source = ts.createSourceFile(
          path,
          await readFile(path, "utf-8"),
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX
        );
        const exported: string[] = [];
        for (const node of source.statements) {
          if (
            ts.isExportDeclaration(node) &&
            !node.isTypeOnly &&
            node.exportClause &&
            ts.isNamedExports(node.exportClause)
          ) {
            for (const specifier of node.exportClause.elements) {
              if (
                !specifier.isTypeOnly &&
                /^[A-Z]/u.test(specifier.name.text)
              ) {
                exported.push(specifier.name.text);
              }
            }
          }
          if (
            ts.isFunctionDeclaration(node) &&
            node.modifiers?.some(
              ({ kind }) => kind === ts.SyntaxKind.ExportKeyword
            ) === true &&
            node.name &&
            /^[A-Z]/u.test(node.name.text)
          ) {
            exported.push(node.name.text);
          }
        }
        return { family: family.name, names: exported.toSorted() };
      })
    );
    expect(actual).toStrictEqual(
      registry.families.map((family) => ({
        family: family.name,
        names: family.components.toSorted(),
      }))
    );
  });

  it.each(examples)(
    "renders $kind: $family as standalone document content",
    async ({ source }) => {
      const { body } = await renderDoc(source);
      expect(body).toContain('data-slot="wireframe"');
      expect(body).not.toContain("[object Object]");
      const ascii = await mdxToAscii(source);
      expect(ascii.warnings).toStrictEqual([]);
      expect(ascii.markdown).not.toContain("<Wireframe");
    }
  );

  it("bundles a single leaf without pulling the full registry into the browser", async () => {
    const html = await render('<WireframeText label="A placeholder" />');
    expect(html).toContain("hydrateRoot");
    const script =
      [...html.matchAll(/<script>(?<code>[\s\S]*?)<\/script>/gu)]
        .map((match) => match.groups?.code ?? "")
        .find((code) => code.includes("hydrateRoot")) ?? "";
    expect({
      dashboard: script.includes('"Dashboard"'),
      drawer: script.includes("vaul-drawer"),
      toast: script.includes("data-sonner-toaster"),
    }).toStrictEqual({ dashboard: false, drawer: false, toast: false });
  });
});

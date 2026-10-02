import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DocumentDiagnostic } from "../src/check-diagnostics.js";
import { checkSource } from "../src/check-source.js";
import { checkDocument, checkDocuments } from "../src/check.js";

describe("document validation", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-check-"));
    file = path.join(dir, "plan.mdx");
  });

  afterEach(async () => {
    await rm(dir, { force: true, recursive: true });
  });

  it("collects independent component and attribute errors with source locations", () => {
    const diagnostics = checkSource(
      `<Steps>
  <Step
    sttaus="done"
    status="wrong">Task</Step>
</Steps>

<Stepp />

<Figure />`,
      file
    );

    expect(diagnostics).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "mdxr:unknown-attribute",
          column: 5,
          file,
          line: 3,
          severity: "warning",
          suggestion: "status",
        }),
        expect.objectContaining({
          code: "mdxr:invalid-props",
          file,
          line: 4,
          severity: "error",
        }),
        expect.objectContaining({
          code: "mdxr:unknown-component",
          line: 7,
          severity: "error",
          suggestion: "Step",
        }),
        expect.objectContaining({
          code: "mdxr:invalid-props",
          line: 9,
          severity: "error",
        }),
      ])
    );
  });

  it("accepts bare flags, directives, Markdown, and passthrough attributes", () => {
    const diagnostics = checkSource(
      `---
title: Plan
---

:::note
An ordinary note with $x^2$.
:::

<Steps progress><Step status="done" data-test="task" aria-label="Task">Done</Step></Steps>

<Button variant="outline">Continue</Button>

<WireframeAccordionItem value="item"><WireframeLabel htmlFor="field">Name</WireframeLabel></WireframeAccordionItem>`,
      file
    );

    expect(diagnostics).toStrictEqual([]);
  });

  it("reports all prohibited expressions without executing them", () => {
    const diagnostics = checkSource(
      'import marker from "never-imported";\n\n{marker()}\n\n<Step status={marker()} />',
      file
    );

    expect(
      diagnostics.filter(({ code }) => code === "mdxr:no-js")
    ).toHaveLength(3);
    expect(
      diagnostics.every(({ severity }) => severity === "error")
    ).toBeTruthy();
  });

  it("collects unresolved citations and cross references in one document", () => {
    const diagnostics = checkSource(
      '<Cite source="missing-source" />\n\n<CrossRef target="missing-one" />\n\n<CrossRef target="missing-two" />',
      file
    );

    expect(
      diagnostics.filter(({ code }) => code === "mdxr:references")
    ).toHaveLength(3);
    expect(diagnostics.map(({ line }) => line)).toStrictEqual([1, 3, 5]);
  });

  it("checks included content with its original file and resolves shared references", async () => {
    const included = path.join(dir, "parts", "details.mdx");
    await mkdir(path.dirname(included));
    await writeFile(
      included,
      '# Details\n\n<Step sttaus="done">Included task</Step>\n\n<CrossRef target="root-figure" />\n'
    );
    const source =
      '<Figure id="root-figure" src="data:image/png;base64,AA==" alt="Figure" />\n\n<Include path="parts/details.mdx" />';
    await writeFile(file, source);
    const diagnostics = checkSource(source, file);

    expect(diagnostics).toStrictEqual([
      expect.objectContaining<Partial<DocumentDiagnostic>>({
        code: "mdxr:unknown-attribute",
        file: await realpath(included),
        line: 3,
        suggestion: "status",
      }),
    ]);
  });

  it("validates nested includes, relative resources, ranges, and anchor targets", async () => {
    await mkdir(path.join(dir, "parts"));
    await writeFile(path.join(dir, "parts", "code.ts"), "const value = 1;\n");
    await writeFile(
      path.join(dir, "parts", "child.mdx"),
      '# Child\n\n<CodeFile path="code.ts" lines="1" />\n'
    );
    await writeFile(
      path.join(dir, "parts", "parent.mdx"),
      '<Include path="child.mdx" />'
    );
    const source =
      '# Root\n\n[Child](parts/child.mdx#child)\n\n<Include path="parts/parent.mdx" />';
    await writeFile(file, source);

    expect(checkSource(source, file)).toStrictEqual([]);
    const invalid = checkSource(
      '<CodeFile path="parts/code.ts" lines="9" />\n\n![Missing](missing.png)\n\n[Missing heading](#missing)',
      file
    );
    expect(invalid.map(({ code }) => code)).toStrictEqual(
      expect.arrayContaining([
        "mdxr:invalid-lines",
        "mdxr:local-reference",
        "mdxr:missing-anchor",
      ])
    );
  });

  it("reports an included research claim's missing source at the claim's original location", async () => {
    const included = path.join(dir, "claim.mdx");
    await writeFile(
      included,
      '# Evidence\n\n<ResearchClaim kind="proposal" source="missing">Needs evidence.</ResearchClaim>\n'
    );

    expect(checkSource('<Include path="claim.mdx" />', file)).toStrictEqual([
      expect.objectContaining({
        code: "mdxr:references",
        file: await realpath(included),
        line: 3,
        message: "Unknown citation source: missing",
      }),
    ]);
  });

  it("reports duplicate references, attributes, and include cycles", async () => {
    const source = '<Include path="plan.mdx" />';
    await writeFile(file, source);
    expect(checkSource(source, file)).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "mdxr:include",
          message: expect.stringContaining("cycle") as unknown,
        }),
      ])
    );
    expect(
      checkSource('<Step status="done" status="todo" />', file)
    ).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "mdxr:duplicate-attribute" }),
      ])
    );
    const duplicated = checkSource(
      '<Figure id="same" src="data:image/png;base64,AA==" />\n\n<Figure id="same" src="data:image/png;base64,AA==" />\n\n<CrossRef target="same" />',
      file
    );
    expect(duplicated).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "mdxr:references",
          message: "Duplicate reference id: same",
        }),
      ])
    );
  });

  it("continues checking references after an include fails", () => {
    const diagnostics = checkSource(
      '<Include path="missing.mdx" />\n\n<CrossRef target="unknown" />\n\n<Step status="wrong" />',
      file
    );

    expect(diagnostics.map(({ code }) => code)).toStrictEqual(
      expect.arrayContaining([
        "mdxr:include",
        "mdxr:references",
        "mdxr:invalid-props",
      ])
    );
  });

  it("continues after a malformed file and excludes build output, history and symlinks", async () => {
    await writeFile(path.join(dir, "a.mdx"), "<Step");
    await writeFile(path.join(dir, "b.markdown"), '<Step status="wrong" />');
    await mkdir(path.join(dir, "node_modules"));
    await writeFile(path.join(dir, "node_modules", "invalid.mdx"), "{1}");
    await mkdir(path.join(dir, ".mdxr", "history"), { recursive: true });
    await writeFile(path.join(dir, ".mdxr", "history", "invalid.mdx"), "{1}");
    await symlink(path.join(dir, "b.markdown"), path.join(dir, "linked.mdx"));
    const result = await checkDocuments(dir);

    expect(result.files.map((name) => path.basename(name))).toStrictEqual([
      "a.mdx",
      "b.markdown",
    ]);
    expect(result.diagnostics.map(({ code }) => code)).toStrictEqual([
      "mdxr:syntax",
      "mdxr:invalid-props",
    ]);
    expect(result.ok).toBeFalsy();
    expect(existsSync(path.join(dir, "b.html"))).toBeFalsy();
    expect(
      result.diagnostics.map(({ file: diagnosticFile }) => diagnosticFile)
    ).toStrictEqual(result.files);
  });

  it("only fails warnings when strict is enabled and never loads configuration by default", async () => {
    await writeFile(file, '<Step sttaus="done" />');
    await writeFile(
      path.join(dir, "mdxr.config.ts"),
      'throw new Error("configuration was evaluated");\nexport default {};'
    );

    await expect(checkDocuments(file)).resolves.toMatchObject({
      errors: 0,
      ok: true,
      warnings: 1,
    });
    await expect(checkDocuments(file, { strict: true })).resolves.toMatchObject(
      { errors: 0, ok: false, warnings: 1 }
    );
    await expect(checkDocuments(file, { render: true })).resolves.toMatchObject(
      {
        diagnostics: [
          expect.objectContaining({
            code: "mdxr:config",
            message: "configuration was evaluated",
          }),
        ],
        ok: false,
      }
    );
  });

  it("loads project components and reports render-time errors when requested", async () => {
    await writeFile(
      path.join(dir, "mdxr.config.ts"),
      'export default { components: "./components.tsx" };'
    );
    await writeFile(
      path.join(dir, "components.tsx"),
      'export const ProjectBadge = () => { throw new Error("component render failed"); };'
    );
    const source = "<ProjectBadge />";

    await expect(checkDocument(source, file)).resolves.toStrictEqual([
      expect.objectContaining({ code: "mdxr:unknown-component" }),
    ]);
    await expect(
      checkDocument(source, file, { render: true })
    ).resolves.toStrictEqual([
      expect.objectContaining({
        code: "mdxr:render",
        message: "component render failed",
      }),
    ]);
  });
});

import path from "node:path";

import type { Node, Parent } from "unist";
import { VFile } from "vfile";
import { describe, expect, it } from "vitest";

import type { MdxTarget } from "../src/remark/ast.js";
import { remarkCodeFile } from "../src/remark/code-file.js";
import { remarkMdxrDirectives } from "../src/remark/directives.js";

const here = import.meta.dirname;

/** `<CodeFile ... />` as an mdast node (attributes as mdxJsxAttribute[]). */
const codeFileEl = (attrs: Record<string, string>): MdxTarget => ({
  attributes: Object.entries(attrs).map(([name, value]) => ({
    name,
    type: "mdxJsxAttribute",
    value,
  })),
  children: [],
  name: "CodeFile",
  type: "mdxJsxFlowElement",
});

/** Wrap `el` in a root, run the plugin, and hand back the (mutated) node. */
const runCodeFile = (el: Node): { file: VFile; node: Node | undefined } => {
  const tree: Parent = { children: [el], type: "root" };
  const file = new VFile({ path: path.join(here, "doc.mdx") });
  remarkCodeFile()(tree, file);
  return { file, node: tree.children[0] };
};

describe(remarkCodeFile, () => {
  const failWith =
    (el: Node): (() => void) =>
    () => {
      const tree: Parent = { children: [el], type: "root" };
      const file = new VFile({ path: path.join(here, "doc.mdx") });
      remarkCodeFile()(tree, file);
    };

  it("fails when `path` is missing", () => {
    expect(failWith(codeFileEl({}))).toThrow(/requires a `path`/u);
  });

  it("fails when the file cannot be read", () => {
    expect(failWith(codeFileEl({ path: "no-such-file.ts" }))).toThrow(
      /cannot read/u
    );
  });

  it("fails on an invalid lines range", () => {
    expect(
      failWith(codeFileEl({ lines: "banana", path: "fixtures/sample.ts" }))
    ).toThrow(/invalid lines range/u);
  });

  it("fails when the range exceeds the file length", () => {
    expect(
      failWith(
        codeFileEl({ lines: "99999-100000", path: "fixtures/sample.ts" })
      )
    ).toThrow(/out of range/u);
  });

  it("mutates the element into a code node with the file's content", () => {
    const { node } = runCodeFile(codeFileEl({ path: "fixtures/sample.ts" }));
    expect(node?.type).toBe("code");
    expect(node).not.toHaveProperty("name");
    expect(node).not.toHaveProperty("attributes");
    expect(node).toMatchObject({
      lang: "ts",
      meta: 'title="fixtures/sample.ts"',
    });
    expect(node).toHaveProperty("value", expect.stringContaining("export"));
  });

  it("slices the content to the requested line range", () => {
    const { node } = runCodeFile(
      codeFileEl({ lines: "1-2", path: "fixtures/sample.ts" })
    );
    expect(node).toHaveProperty("meta", 'title="fixtures/sample.ts:1-2"');
    expect(node).toHaveProperty(
      "value",
      "export const alpha = 1;\nexport const beta = 2;"
    );
  });
});

const directive = (
  name: string,
  type:
    | "containerDirective"
    | "leafDirective"
    | "textDirective" = "containerDirective",
  children: Node[] = []
): MdxTarget => ({
  attributes: {},
  children,
  name,
  type,
});

const text = (value: string): MdxTarget => ({ type: "text", value });

const runDirectives = (el: Node): { file: VFile; node: Node | undefined } => {
  const tree: Parent = { children: [el], type: "root" };
  const file = new VFile({ path: "doc.mdx" });
  remarkMdxrDirectives()(tree, file);
  return { file, node: tree.children[0] };
};

describe(remarkMdxrDirectives, () => {
  it("normalizes uppercase directive names", () => {
    const { node } = runDirectives(
      directive("WARNING", "containerDirective", [text("careful")])
    );
    expect(node).toMatchObject({
      name: "Callout",
      type: "mdxJsxFlowElement",
    });
  });

  it("maps container directives to their component", () => {
    const { node } = runDirectives(
      directive("phase", "containerDirective", [text("work")])
    );
    expect(node).toMatchObject({ name: "Phase", type: "mdxJsxFlowElement" });
  });

  it("warns on unknown directive names and leaves the node alone", () => {
    const { file, node } = runDirectives(directive("bogus"));
    expect(node?.type).toBe("containerDirective");
    expect(file.messages.map(String).join("\n")).toMatch(
      /Unknown directive ":::bogus"/u
    );
  });

  it("warns when a container component is used as a leaf directive", () => {
    const { file, node } = runDirectives(directive("phase", "leafDirective"));
    expect(node?.type).toBe("leafDirective");
    expect(file.messages.map(String).join("\n")).toMatch(
      /container directive — use three colons/u
    );
  });

  it("accepts non-goal as an alias of the nongoal callout", () => {
    const { node } = runDirectives(
      directive("non-goal", "containerDirective", [text("x")])
    );
    expect(node).toMatchObject({ name: "Callout" });
    expect(node).toHaveProperty(
      "attributes",
      expect.arrayContaining([
        expect.objectContaining({ name: "kind", value: "nongoal" }),
      ])
    );
  });
});

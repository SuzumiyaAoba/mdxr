import { existsSync } from "node:fs";
import path from "node:path";

import type { Node } from "unist";
import { visitParents } from "unist-util-visit-parents";
import type { VFile } from "vfile";

import { splitPathLines } from "../lines.js";
import type { MdxTarget } from "./ast.js";
import { toMdxElement } from "./ast.js";

/**
 * Inline code that names a real file path — `` `src/mdx.ts` `` — becomes a
 * `<FileRef>` chip, so prose references get the same editor link, icon, and
 * copy button as an explicit component. The value must contain a `/` (a bare
 * `file.ts` stays code) and resolve to an existing file relative to the
 * document; a trailing `:N`/`:N-M` becomes `lines`. Paths inside links are
 * left alone — a chip can't nest inside <a>. Runs late in the pipeline so
 * directive labels and heading slugs are already computed.
 */
export const remarkFilePaths = () => (tree: Node, file: VFile) => {
  const dir = file.dirname ?? ".";
  const resolve = (
    value: string
  ): { lines?: string; path: string } | undefined => {
    if (!value.includes("/") || value.includes("://")) {
      return undefined;
    }
    const target = splitPathLines(value);
    if (existsSync(path.resolve(dir, target.path))) {
      return target;
    }
    // A file literally named "x.ts:2" beats the lines interpretation.
    return target.lines !== undefined && existsSync(path.resolve(dir, value))
      ? { path: value }
      : undefined;
  };
  visitParents(tree, "inlineCode", (node: Node, ancestors: Node[]) => {
    // Links keep plain code — FileRef renders its own <a>, and nested
    // anchors break in the HTML parser. Raw JSX <a> wrappers count too:
    // they're mdxJsx elements, not "link" nodes.
    const inLink = ancestors.some(
      (a) =>
        a.type === "link" ||
        a.type === "linkReference" ||
        ((a.type === "mdxJsxTextElement" || a.type === "mdxJsxFlowElement") &&
          (a as MdxTarget).name === "a")
    );
    if (inLink || !("value" in node) || typeof node.value !== "string") {
      return;
    }
    const target = resolve(node.value);
    if (target === undefined) {
      return;
    }
    const el: MdxTarget = node;
    toMdxElement(el, "mdxJsxTextElement", "FileRef", {
      lines: target.lines,
      path: target.path,
    });
    el.children = [];
    delete el.value;
  });
};

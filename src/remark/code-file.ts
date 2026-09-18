import { readFileSync } from "node:fs";
import path from "node:path";

import type { Node } from "unist";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

import { parseLineRange } from "../lines.js";
import type { MdxTarget } from "./ast.js";
import { isFlowElement, jsxAttr } from "./ast.js";

/** A flow element that becomes a `code` node after mutation. */
interface CodeTarget extends MdxTarget {
  lang?: string;
  meta?: string;
}

/**
 * `<CodeFile path="src/foo.ts" lines="40-52" lang="ts" />` embeds a real file
 * from disk as a fenced code block, so code explanations quote the actual
 * source instead of drifting copies. `path` resolves relative to the
 * document; `lines` slices a 1-based range; `lang` overrides the extension.
 * The emitted `code` node carries `title="…"` meta so `remarkCodeMeta` /
 * `Pre` render the usual filename header — run this before remarkCodeMeta.
 */
export const remarkCodeFile = () => (tree: Node, file: VFile) => {
  visit(tree, "mdxJsxFlowElement", (node: Node) => {
    if (!isFlowElement(node) || node.name !== "CodeFile") {
      return;
    }
    const rel = jsxAttr(node, "path");
    if (rel === undefined) {
      file.fail(
        "<CodeFile> requires a `path` attribute",
        node,
        "mdxr:code-file"
      );
    }
    const abs = path.resolve(file.dirname ?? ".", rel);
    let content: string;
    try {
      content = readFileSync(abs, "utf-8");
    } catch {
      file.fail(`<CodeFile> cannot read ${rel}`, node, "mdxr:code-file");
    }

    const rangeSpec = jsxAttr(node, "lines");
    let titleSuffix = "";
    if (rangeSpec !== undefined) {
      const range = parseLineRange(rangeSpec);
      if (range === undefined) {
        file.fail(
          `<CodeFile> invalid lines range: ${rangeSpec}`,
          node,
          "mdxr:code-file"
        );
      }
      const all = content.replace(/\n$/u, "").split("\n");
      if (range.start > all.length) {
        file.fail(
          `<CodeFile> lines ${rangeSpec} out of range (${all.length} lines in ${rel})`,
          node,
          "mdxr:code-file"
        );
      }
      content = all.slice(range.start - 1, range.end).join("\n");
      titleSuffix = `:${rangeSpec}`;
    }

    const lang = jsxAttr(node, "lang") ?? path.extname(abs).replace(/^\./u, "");
    const target: CodeTarget = node;
    target.type = "code";
    delete target.name;
    delete target.attributes;
    delete target.children;
    target.lang = lang === "" ? undefined : lang;
    target.meta = `title="${rel}${titleSuffix}"`;
    target.value = content;
  });
};

import { readFileSync } from "node:fs";
import path from "node:path";

import type { Node } from "unist";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

import { isRecord } from "../guards.js";

/** An `mdxJsxFlowElement`, and (after mutation) a `code` node. */
interface MutableNode extends Node {
  attributes?: unknown;
  children?: Node[];
  lang?: string;
  meta?: string;
  name?: string;
  value?: string;
}

const isFlowElement = (n: Node): n is MutableNode =>
  n.type === "mdxJsxFlowElement";

const attr = (node: MutableNode, name: string): string | undefined => {
  if (!Array.isArray(node.attributes)) {
    return undefined;
  }
  for (const a of node.attributes) {
    if (
      isRecord(a) &&
      a.name === name &&
      typeof a.value === "string" &&
      a.value !== ""
    ) {
      return a.value;
    }
  }
  return undefined;
};

/** `lines="40-52"`, `lines="40"`, `lines="40-"` → 1-based inclusive range. */
const parseLines = (
  spec: string
): { end: number | undefined; start: number } | undefined => {
  const m = /^(?<start>\d+)(?:-(?<end>\d*))?$/u.exec(spec.trim());
  if (m?.groups === undefined) {
    return undefined;
  }
  const start = Number(m.groups.start);
  let end: number | undefined;
  if (m.groups.end === undefined) {
    end = start;
  } else if (m.groups.end !== "") {
    end = Number(m.groups.end);
  }
  if (start < 1 || (end !== undefined && end < start)) {
    return undefined;
  }
  return { end, start };
};

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
    const rel = attr(node, "path");
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

    const rangeSpec = attr(node, "lines");
    let titleSuffix = "";
    if (rangeSpec !== undefined) {
      const range = parseLines(rangeSpec);
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

    const lang = attr(node, "lang") ?? path.extname(abs).replace(/^\./u, "");
    node.type = "code";
    delete node.name;
    delete node.attributes;
    delete node.children;
    node.lang = lang === "" ? undefined : lang;
    node.meta = `title="${rel}${titleSuffix}"`;
    node.value = content;
  });
};

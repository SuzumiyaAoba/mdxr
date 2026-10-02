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
 * source document (including an included file); a trailing `:N`/`:N-M` becomes
 * `lines`. Paths inside links are left alone — a chip can't nest inside <a>.
 * Runs late in the pipeline so directive labels and heading slugs are already
 * computed.
 */
export const remarkFilePaths = () => (tree: Node, file: VFile) => {
  const dir = file.dirname ?? ".";
  const resolve = (
    value: string,
    origin: string
  ): { lines?: string; path: string } | undefined => {
    if (!value.includes("/") || value.includes("://")) {
      return undefined;
    }
    let target = splitPathLines(value);
    if (!existsSync(path.resolve(origin, target.path))) {
      // A file literally named "x.ts:2" beats the lines interpretation.
      if (
        target.lines === undefined ||
        !existsSync(path.resolve(origin, value))
      ) {
        return undefined;
      }
      target = { path: value };
    }
    if (!path.isAbsolute(target.path) && path.relative(dir, origin) !== "") {
      target.path = path
        .relative(dir, path.resolve(origin, target.path))
        .split(path.sep)
        .join("/");
    }
    return target;
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
    const origin = node.data?.mdxrSourceFile;
    const target = resolve(
      node.value,
      origin === undefined ? dir : path.dirname(origin)
    );
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

import { existsSync } from "node:fs";
import path from "node:path";

import type { Node } from "unist";
import type { VFile } from "vfile";

/** An `inlineCode` node, and (after mutation) an `mdxJsxTextElement`. */
interface MutableNode extends Node {
  attributes?: unknown;
  children?: Node[];
  name?: string;
  value?: string;
}

/** "`src/a.ts:40-52`" → path + lines spec, like a code-fence `title=`. */
const splitLines = (value: string): { lines?: string; path: string } => {
  const m = /^(?<p>.+):(?<ls>\d+(?:-\d*)?)$/u.exec(value);
  return m?.groups === undefined
    ? { path: value }
    : { lines: m.groups.ls, path: m.groups.p };
};

const toFileRef = (node: MutableNode, rel: string, lines?: string): void => {
  node.type = "mdxJsxTextElement";
  node.name = "FileRef";
  node.attributes = [
    { name: "path", type: "mdxJsxAttribute", value: rel },
    ...(lines === undefined
      ? []
      : [{ name: "lines", type: "mdxJsxAttribute", value: lines }]),
  ];
  node.children = [];
  delete node.value;
};

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
    const target = splitLines(value);
    if (existsSync(path.resolve(dir, target.path))) {
      return target;
    }
    // A file literally named "x.ts:2" beats the lines interpretation.
    return target.lines !== undefined && existsSync(path.resolve(dir, value))
      ? { path: value }
      : undefined;
  };
  const walk = (node: Node, inLink: boolean): void => {
    if (node.type === "inlineCode") {
      const { value } = node as MutableNode;
      const target = inLink || value === undefined ? undefined : resolve(value);
      if (target !== undefined) {
        toFileRef(node, target.path, target.lines);
      }
      return;
    }
    const nested =
      inLink || node.type === "link" || node.type === "linkReference";
    const { children } = node as Node & { children?: Node[] };
    if (children !== undefined) {
      for (const child of children) {
        walk(child, nested);
      }
    }
  };
  walk(tree, false);
};

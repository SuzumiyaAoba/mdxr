import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";

import remarkDirective from "remark-directive";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Node, Parent } from "unist";
import type { VFile } from "vfile";

import { isRecord } from "../guards.js";
import { isParent, jsxAttr, jsxAttrs, textContent } from "./ast.js";
import type { MdxTarget } from "./ast.js";
import { remarkMdxrDirectives } from "./directives.js";
import { remarkNoJs } from "./no-js.js";

declare module "unist" {
  interface Data {
    mdxrSourceFile?: string;
  }
}

const parser = unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(remarkFrontmatter)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkDirective);
const REMOTE = /^(?:[a-z][a-z\d+.-]*:|#|\/)/iu;
const isInclude = (node: Node): node is MdxTarget =>
  (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
  "name" in node &&
  node.name === "Include";
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replaceAll(/\s+/gu, "-");

const sectionNodes = (nodes: Node[], section: string): Node[] => {
  const start = nodes.findIndex(
    (node) =>
      node.type === "heading" &&
      (textContent(node) === section || slug(textContent(node)) === section)
  );
  const first = nodes[start];
  if (
    !(first !== undefined) ||
    !("depth" in first) ||
    typeof first.depth !== "number"
  ) {
    throw new Error(`Include: section not found: ${section}`);
  }
  let end = start + 1;
  while (end < nodes.length) {
    const node = nodes[end];
    if (
      node?.type === "heading" &&
      "depth" in node &&
      typeof node.depth === "number" &&
      node.depth <= first.depth
    ) {
      break;
    }
    end += 1;
  }
  return nodes.slice(start, end);
};

const rebase = (node: Node, origin: string, root: string): void => {
  if (origin === root) {
    return;
  }
  const relative = (value: string): string =>
    REMOTE.test(value)
      ? value
      : path
          .relative(root, path.resolve(origin, value))
          .split(path.sep)
          .join("/");
  if ("url" in node && typeof node.url === "string") {
    node.url = relative(node.url);
  }
  if (!("attributes" in node) || !Array.isArray(node.attributes)) {
    return;
  }
  for (const attr of node.attributes) {
    if (
      isRecord(attr) &&
      ["path", "src", "poster", "href"].includes(String(attr.name)) &&
      typeof attr.value === "string"
    ) {
      attr.value = relative(attr.value);
    }
  }
};

const includedDocument = (
  target: MdxTarget,
  origin: string,
  chain: string[],
  file: VFile
): { abs: string; tree: Parent } => {
  const source = jsxAttr(target, "path");
  if (source === undefined || source === "") {
    file.fail("Include requires path", target);
  }
  const abs = realpathSync(path.resolve(path.dirname(origin), source));
  const ancestors = new Set(chain);
  if (ancestors.has(abs)) {
    file.fail(`Include cycle: ${[...chain, abs].join(" → ")}`, target);
  }
  const included = parser.parse(readFileSync(abs, "utf-8"));
  remarkNoJs()(included, file);
  remarkMdxrDirectives()(included, file);
  const section = jsxAttr(target, "section");
  const nodes = included.children.filter((node) => node.type !== "yaml");
  const tree: Parent = {
    children:
      section === undefined || section === ""
        ? nodes
        : sectionNodes(nodes, section),
    type: "root",
  };
  target.attributes = jsxAttrs({ path: source, section });
  return { abs, tree };
};

export const remarkInclude = () => (tree: Node, file: VFile) => {
  remarkNoJs()(tree, file);
  const rootFile = path.resolve(file.path || "document.mdx");
  const root = path.dirname(rootFile);
  const expand = (parent: Parent, origin: string, chain: string[]): void => {
    if (chain.length > 32) {
      file.fail("Include: nesting exceeds 32 files");
    }
    for (const child of parent.children) {
      child.data = { ...child.data, mdxrSourceFile: origin };
      if (isInclude(child)) {
        const included = includedDocument(child, origin, chain, file);
        expand(included.tree, included.abs, [...chain, included.abs]);
        child.children = included.tree.children;
        continue;
      }
      rebase(child, path.dirname(origin), root);
      if (isParent(child)) {
        expand(child, origin, chain);
      }
    }
  };
  if (isParent(tree)) {
    expand(tree, rootFile, [rootFile]);
  }
};

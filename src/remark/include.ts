import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

import remarkDirective from "remark-directive";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Node, Parent } from "unist";
import { VFile } from "vfile";

import { isRecord } from "../guards.js";
import { isParent, jsxAttr, jsxAttrs, textContent } from "./ast.js";
import type { MdxTarget } from "./ast.js";
import { remarkMdxrDirectives } from "./directives.js";
import { createHeadingSlugger } from "./headings.js";
import { remarkNoJs } from "./no-js.js";

declare module "unist" {
  interface Data {
    mdxrSourceFile?: string;
  }
}

export interface LinkedDocument {
  ancestors: string[];
  id: string;
  path: string;
  section?: string;
}

export interface IncludeOptions {
  ancestors?: string[];
  inlineAssets?: boolean;
  section?: string;
}

declare module "vfile" {
  interface DataMap {
    includeDependencies?: string[];
    linkedDocuments?: LinkedDocument[];
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
const isDocumentReference = (node: Node): node is MdxTarget =>
  (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
  "name" in node &&
  (node.name === "Include" || node.name === "DocumentLink");
const sectionNodes = (nodes: Node[], section: string): Node[] => {
  const slugFor = createHeadingSlugger();
  const slugs = new Map<Node, string>();
  const assignSlugs = (items: Node[]): void => {
    for (const node of items) {
      if (node.type === "heading") {
        slugs.set(node, slugFor(textContent(node).trim()));
      }
      if (isParent(node)) {
        assignSlugs(node.children);
      }
    }
  };
  assignSlugs(nodes);
  const headings = nodes.flatMap((node) => {
    if (node.type !== "heading") {
      return [];
    }
    const text = textContent(node).trim();
    return [{ node, slug: slugs.get(node) ?? "", text }];
  });
  const heading =
    headings.find((item) => item.slug === section) ??
    headings.find((item) => item.text === section);
  const start = heading === undefined ? -1 : nodes.indexOf(heading.node);
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

const includePath = (
  target: MdxTarget,
  origin: string,
  chain: string[],
  file: VFile
): string => {
  const source = jsxAttr(target, "path");
  if (source === undefined || source === "") {
    file.fail(`${target.name} requires path`, target);
  }
  if (
    target.name === "DocumentLink" &&
    ![".md", ".mdx"].includes(path.extname(source).toLowerCase())
  ) {
    file.fail(
      "DocumentLink requires an .md or .mdx file",
      target,
      "mdxr:include"
    );
  }
  const abs = realpathSync(path.resolve(path.dirname(origin), source));
  const ancestors = new Set(chain);
  if (ancestors.has(abs)) {
    file.fail(`Include cycle: ${[...chain, abs].join(" → ")}`, target);
  }
  file.data.includeDependencies ??= [];
  file.data.includeDependencies.push(abs);
  return abs;
};

const includedDocument = (
  target: MdxTarget,
  abs: string,
  parentFile: VFile
): Parent => {
  const file = new VFile({ path: abs, value: readFileSync(abs, "utf-8") });
  const included = parser.parse(file);
  remarkNoJs()(included, file);
  remarkMdxrDirectives()(included, file);
  parentFile.messages.push(...file.messages);
  const section = jsxAttr(target, "section");
  const nodes = included.children.filter((node) => node.type !== "yaml");
  return {
    children:
      section === undefined || section === ""
        ? nodes
        : sectionNodes(nodes, section),
    type: "root",
  };
};

const linkDocument = (
  target: MdxTarget,
  abs: string,
  chain: string[],
  file: VFile
): void => {
  file.data.linkedDocuments ??= [];
  const documents = file.data.linkedDocuments;
  const section = jsxAttr(target, "section");
  const id = `mdxr-document-${documents.length + 1}`;
  documents.push({ ancestors: chain, id, path: abs, section });
  target.attributes = jsxAttrs({
    document: id,
    label: jsxAttr(target, "label"),
    path: jsxAttr(target, "path"),
    section,
  });
  target.children = [];
};

export const remarkInclude =
  (opts: IncludeOptions = {}) =>
  (tree: Node, file: VFile) => {
    remarkNoJs()(tree, file);
    const filename = path.resolve(file.path || "document.mdx");
    const rootFile = existsSync(filename) ? realpathSync(filename) : filename;
    const directory = path.dirname(filename);
    const root = existsSync(directory) ? realpathSync(directory) : directory;
    const expand = (parent: Parent, origin: string, chain: string[]): void => {
      if (chain.length > 32) {
        file.fail("Include: nesting exceeds 32 files");
      }
      const originDirectory = origin === filename ? root : path.dirname(origin);
      for (const child of parent.children) {
        child.data = { ...child.data, mdxrSourceFile: origin };
        if (isDocumentReference(child)) {
          if (child.name === "Include" && child.type === "mdxJsxTextElement") {
            file.fail(
              "Include must be used as a block element",
              child,
              "mdxr:include"
            );
          }
          const abs = includePath(child, origin, chain, file);
          if (child.name === "DocumentLink") {
            linkDocument(child, abs, chain, file);
            rebase(child, originDirectory, root);
            continue;
          }
          const included = includedDocument(child, abs, file);
          expand(included, abs, [...chain, abs]);
          child.attributes = jsxAttrs({
            path: jsxAttr(child, "path"),
            section: jsxAttr(child, "section"),
          });
          child.children = included.children;
          continue;
        }
        rebase(child, originDirectory, root);
        if (isParent(child)) {
          expand(child, origin, chain);
        }
      }
    };
    if (isParent(tree)) {
      if (opts.section !== undefined) {
        tree.children = [
          ...tree.children.filter((node) => node.type === "yaml"),
          ...sectionNodes(
            tree.children.filter((node) => node.type !== "yaml"),
            opts.section
          ),
        ];
      }
      expand(tree, filename, [...(opts.ancestors ?? []), rootFile]);
    }
  };

import { createHash } from "node:crypto";
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
import { visit } from "unist-util-visit";
import { VFile } from "vfile";

import { isRecord } from "../guards.js";
import { fenceFilename, splitPathLines } from "../lines.js";
import {
  isParent,
  jsxAttr,
  jsxAttrs,
  setHProperty,
  textContent,
} from "./ast.js";
import type { MdxTarget } from "./ast.js";
import { remarkMdxrDirectives } from "./directives.js";
import { createHeadingSlugger } from "./headings.js";
import { remarkNoJs } from "./no-js.js";
import {
  referenceDefinitions,
  referencedContent,
} from "./reference-definitions.js";

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
const URL_SUFFIX = /[?#]/u;

const rebasePath = (value: string, origin: string, root: string): string =>
  REMOTE.test(value)
    ? value
    : path
        .relative(root, path.resolve(origin, value))
        .split(path.sep)
        .join("/");

/** Rebase the decoded pathname while preserving the authored URL suffix. */
const rebaseUrl = (value: string, origin: string, root: string): string => {
  if (value === "" || REMOTE.test(value)) {
    return value;
  }
  const suffixStart = value.search(URL_SUFFIX);
  const pathname = suffixStart === -1 ? value : value.slice(0, suffixStart);
  const suffix = suffixStart === -1 ? "" : value.slice(suffixStart);
  if (pathname === "") {
    return value;
  }
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // A literal percent sign may occur in an authored resource filename.
  }
  return (
    path
      .relative(root, path.resolve(origin, decoded))
      .split(path.sep)
      .map(encodeURIComponent)
      .join("/") + suffix
  );
};
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
  const sectionTree: Parent = {
    children: nodes.slice(start, end),
    type: "root",
  };
  const included = new Set<Node>();
  visit(sectionTree, (node) => {
    included.add(node);
  });
  const document: Parent = { children: nodes, type: "root" };
  return [
    ...sectionTree.children,
    ...referencedContent(sectionTree, referenceDefinitions(document)).filter(
      (node) => !included.has(node)
    ),
  ];
};

const REFERENCE_NODE_TYPES = new Set([
  "definition",
  "footnoteDefinition",
  "footnoteReference",
  "imageReference",
  "linkReference",
]);

const scopeReference = (node: Node, namespace: string): void => {
  if (
    !REFERENCE_NODE_TYPES.has(node.type) ||
    !("identifier" in node) ||
    typeof node.identifier !== "string"
  ) {
    return;
  }
  node.identifier = `${namespace}${node.identifier}`;
  if ("label" in node && typeof node.label === "string") {
    node.label = `${namespace}${node.label}`;
  }
};

const rebase = (node: Node, origin: string, root: string): void => {
  if (origin === root) {
    return;
  }
  // Keep authored fence labels while resolving their file links from the
  // included document. CodeFile already rebases its explicit path below.
  if (node.type === "code" && "meta" in node && typeof node.meta === "string") {
    const filename = fenceFilename(node.meta);
    if (filename !== undefined) {
      setHProperty(
        node,
        "data-mdxr-code-path",
        rebasePath(splitPathLines(filename).path, origin, root)
      );
    }
  }
  if ("url" in node && typeof node.url === "string") {
    node.url = rebaseUrl(node.url, origin, root);
  }
  if (!("attributes" in node) || !Array.isArray(node.attributes)) {
    return;
  }
  for (const attr of node.attributes) {
    if (
      !isRecord(attr) ||
      !["path", "src", "poster", "href"].includes(String(attr.name)) ||
      typeof attr.value !== "string"
    ) {
      continue;
    }
    attr.value =
      attr.name === "path"
        ? rebasePath(attr.value, origin, root)
        : rebaseUrl(attr.value, origin, root);
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
    const namespaces = new Map<string, string>();
    const namespaceFor = (origin: string): string => {
      if (origin === filename) {
        return "";
      }
      const existing = namespaces.get(origin);
      if (existing !== undefined) {
        return existing;
      }
      const namespace = `mdxr-include-${createHash("sha256").update(origin).digest("hex").slice(0, 12)}-`;
      namespaces.set(origin, namespace);
      return namespace;
    };
    const expand = (parent: Parent, origin: string, chain: string[]): void => {
      if (chain.length > 32) {
        file.fail("Include: nesting exceeds 32 files");
      }
      const originDirectory = origin === filename ? root : path.dirname(origin);
      const namespace = namespaceFor(origin);
      for (const child of parent.children) {
        scopeReference(child, namespace);
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

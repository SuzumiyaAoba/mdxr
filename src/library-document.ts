import path from "node:path";

import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Node } from "unist";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { matter } from "vfile-matter";

import { isRecord } from "./guards.js";

interface ParsedDocument {
  body: string;
  parseWarning: boolean;
  status: string;
  title: string;
}

const ignoredNodeTypes = new Set([
  "definition",
  "mdxFlowExpression",
  "mdxjsEsm",
  "mdxTextExpression",
  "toml",
  "yaml",
]);
const searchableMdxAttributes = new Set([
  "alt",
  "aria-label",
  "caption",
  "description",
  "heading",
  "label",
  "name",
  "placeholder",
  "summary",
  "text",
  "title",
  "tooltip",
  "value",
]);
const blockNodeTypes = new Set([
  "blockquote",
  "code",
  "heading",
  "listItem",
  "paragraph",
  "tableCell",
  "tableRow",
  "thematicBreak",
]);
const mdxParser = unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(remarkFrontmatter)
  .use(remarkGfm);
const markdownParser = unified()
  .use(remarkParse)
  .use(remarkFrontmatter)
  .use(remarkGfm);

const scalarText = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString();
  }
  return "";
};

const rawNode = (
  node: Node
): Node & {
  alt?: unknown;
  attributes?: unknown[];
  children?: Node[];
  name?: unknown;
  value?: unknown;
} => node;

const appendLeafNodeText = (
  node: Node,
  current: ReturnType<typeof rawNode>,
  chunks: string[]
): boolean => {
  if (
    node.type === "text" ||
    node.type === "inlineCode" ||
    node.type === "code"
  ) {
    if (typeof current.value === "string") {
      chunks.push(current.value);
    }
    return true;
  }
  if (node.type === "image" || node.type === "imageReference") {
    if (typeof current.alt === "string") {
      chunks.push(current.alt);
    }
    return true;
  }
  if (node.type === "break" || node.type === "thematicBreak") {
    chunks.push("\n");
    return true;
  }
  if (node.type === "html" && typeof current.value === "string") {
    chunks.push(
      current.value
        .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/giu, " ")
        .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style\s*>/giu, " ")
        .replaceAll(/<!--[\s\S]*?-->/gu, " ")
        .replaceAll(/<[^>]*>/gu, " ")
    );
    return true;
  }
  return false;
};

const appendMdxAttributes = (
  current: ReturnType<typeof rawNode>,
  chunks: string[]
): void => {
  for (const rawAttribute of current.attributes ?? []) {
    if (!isRecord(rawAttribute)) {
      continue;
    }
    const { name, value } = rawAttribute;
    if (
      typeof name === "string" &&
      searchableMdxAttributes.has(name.toLowerCase()) &&
      typeof value === "string"
    ) {
      chunks.push(value);
    }
  }
};

const appendNodeText = (node: Node, chunks: string[]): void => {
  if (ignoredNodeTypes.has(node.type)) {
    return;
  }

  const current = rawNode(node);
  if (appendLeafNodeText(node, current, chunks)) {
    return;
  }
  if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
    appendMdxAttributes(current, chunks);
  }

  const isBlock = blockNodeTypes.has(node.type);
  if (isBlock) {
    chunks.push("\n");
  }
  for (const child of current.children ?? []) {
    appendNodeText(child, chunks);
  }
  if (isBlock) {
    chunks.push("\n");
  }
};

const plainText = (node: Node): string => {
  const chunks: string[] = [];
  appendNodeText(node, chunks);
  return chunks
    .join("")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll(/[ \t]+\n/gu, "\n")
    .replaceAll(/\n{3,}/gu, "\n\n")
    .trim();
};

const firstHeading = (tree: Node): string => {
  let heading = "";
  visit(tree, "heading", (node: Node) => {
    if (heading === "") {
      heading = plainText(node);
    }
  });
  return heading;
};

const withoutFrontmatter = (source: string): string => {
  const lines = source.replace(/^\uFEFF/u, "").split(/\r?\n/u);
  if (lines[0]?.trim() !== "---") {
    return source;
  }
  const closing = lines.findIndex(
    (line, index) =>
      index > 0 && (line.trim() === "---" || line.trim() === "...")
  );
  return closing === -1 ? source : lines.slice(closing + 1).join("\n");
};

export const parseLibraryDocument = (
  source: string,
  relativePath: string
): ParsedDocument => {
  let metadata: Record<string, unknown> = {};
  let parseWarning = false;
  try {
    const file = new VFile({ value: source });
    matter(file);
    metadata = isRecord(file.data.matter) ? file.data.matter : {};
  } catch {
    parseWarning = true;
  }

  let tree: Node;
  try {
    const parser =
      path.extname(relativePath).toLowerCase() === ".mdx"
        ? mdxParser
        : markdownParser;
    tree = parser.parse(source);
  } catch {
    parseWarning = true;
    tree = markdownParser.parse(withoutFrontmatter(source));
  }

  const titleFromMetadata = scalarText(metadata.title);
  const title =
    titleFromMetadata ||
    firstHeading(tree) ||
    path.basename(relativePath, path.extname(relativePath));

  return {
    body: plainText(tree),
    parseWarning,
    status: scalarText(metadata.status),
    title,
  };
};

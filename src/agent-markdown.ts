import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  depth?: number;
  url?: string;
  ordered?: boolean | null;
}

const ESCAPES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};

const WRAPPERS: Record<string, [string, string]> = {
  blockquote: ["<blockquote>", "</blockquote>"],
  delete: ["<del>", "</del>"],
  emphasis: ["<em>", "</em>"],
  listItem: ["<li>", "</li>"],
  paragraph: ["<p>", "</p>"],
  strong: ["<strong>", "</strong>"],
  table: ["<table>", "</table>"],
  tableCell: ["<td>", "</td>"],
  tableRow: ["<tr>", "</tr>"],
};

const escape = (value: string): string =>
  value.replaceAll(/[&<>"']/gu, (char) => ESCAPES[char] ?? char);

const safeUrl = (value: string): string | undefined => {
  const trimmed = value.trim();
  return /^(?:https?:|mailto:|\/|#)/iu.test(trimmed) ? trimmed : undefined;
};

const renderLiteral = (node: MarkdownNode): string | undefined => {
  if (node.type === "code") {
    return `<pre><code>${escape(node.value ?? "")}</code></pre>`;
  }
  if (node.type === "inlineCode") {
    return `<code>${escape(node.value ?? "")}</code>`;
  }
  if (node.type === "break") {
    return "<br>";
  }
  if (node.type === "thematicBreak") {
    return "<hr>";
  }
  return undefined;
};

const renderNode = (node: MarkdownNode): string => {
  const literal = renderLiteral(node);
  if (literal !== undefined) {
    return literal;
  }
  const children = (node.children ?? []).map(renderNode).join("");
  const wrapper = WRAPPERS[node.type];
  if (wrapper !== undefined) {
    return `${wrapper[0]}${children}${wrapper[1]}`;
  }
  if (node.type === "heading") {
    const depth = Math.min(Math.max(node.depth ?? 1, 1), 6);
    return `<h${depth}>${children}</h${depth}>`;
  }
  if (node.type === "list") {
    return node.ordered === true
      ? `<ol>${children}</ol>`
      : `<ul>${children}</ul>`;
  }
  if (node.type === "link") {
    const url = safeUrl(node.url ?? "");
    return url === undefined
      ? children
      : `<a href="${escape(url)}" rel="noopener noreferrer" target="_blank">${children}</a>`;
  }
  return children || escape(node.value ?? "");
};

/** Render agent text as inert Markdown; MDX JSX and raw HTML never execute. */
export const renderAgentMarkdown = (source: string): string => {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(source);
  return renderNode(tree);
};

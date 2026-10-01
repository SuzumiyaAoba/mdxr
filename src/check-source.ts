import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import remarkDirective from "remark-directive";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Node } from "unist";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { matter } from "vfile-matter";

import { checkComponent } from "./check-components.js";
import { diagnosticAt, errorDiagnostic } from "./check-diagnostics.js";
import type { DocumentDiagnostic } from "./check-diagnostics.js";
import type { ComponentMap } from "./define.js";
import { urlScheme } from "./guards.js";
import { parseLineRange } from "./lines.js";
import { remarkMdxrAlerts } from "./remark/alerts.js";
import { jsxAttr, textContent } from "./remark/ast.js";
import type { MdxTarget } from "./remark/ast.js";
import { remarkMdxrDirectives } from "./remark/directives.js";
import { createHeadingSlugger } from "./remark/headings.js";
import { remarkInclude } from "./remark/include.js";
import { remarkNoJs } from "./remark/no-js.js";
import { remarkReferences } from "./remark/references.js";
import { builtinComponents } from "./ui/index.js";

const parser = unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(remarkFrontmatter)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkDirective);
const JSX_ELEMENTS = new Set(["mdxJsxFlowElement", "mdxJsxTextElement"]);
const EMBEDDED_PATHS = new Set(["Include", "DocumentLink", "CodeFile"]);
const FILE_REFERENCES = new Set([
  "FileRef",
  "File",
  "SymbolRef",
  "TraceFrame",
  "FlowStep",
]);
const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown", ".mdx"]);

const anchorsOf = (tree: Node): Set<string> => {
  const anchors = new Set<string>();
  const slug = createHeadingSlugger();
  visit(tree, (node) => {
    if (node.type === "heading") {
      anchors.add(slug(textContent(node).trim()));
    }
    if (JSX_ELEMENTS.has(node.type)) {
      const id = jsxAttr(node, "id");
      if (id !== undefined) {
        anchors.add(id);
      }
    }
  });
  return anchors;
};

interface LocalReference {
  node: Node;
  value: string;
  severity: DocumentDiagnostic["severity"];
  lines?: string;
  section?: string;
  literalPath?: boolean;
  baseFile?: string;
}

const referenceTarget = (
  value: string,
  literal: boolean
): { target: string; fragment: string } => {
  if (literal) {
    return { fragment: "", target: value };
  }
  const hash = value.indexOf("#");
  const rawPath = hash === -1 ? value : value.slice(0, hash);
  return {
    fragment: hash === -1 ? "" : decodeURIComponent(value.slice(hash + 1)),
    target: decodeURIComponent(rawPath.split("?")[0] ?? ""),
  };
};

const checkLines = (
  reference: LocalReference,
  absolutePath: string,
  file: string
): DocumentDiagnostic[] => {
  if (reference.lines === undefined) {
    return [];
  }
  const range = parseLineRange(reference.lines);
  const count = readFileSync(absolutePath, "utf-8")
    .replace(/\n$/u, "")
    .split("\n").length;
  return range === undefined || range.start > count
    ? [
        diagnosticAt(
          file,
          reference.node,
          "mdxr:invalid-lines",
          `Invalid lines range ${reference.lines} in ${reference.value} (${count} lines).`
        ),
      ]
    : [];
};

const checkSection = (
  reference: LocalReference,
  absolutePath: string,
  section: string,
  file: string
): DocumentDiagnostic[] => {
  if (
    section === "" ||
    !MARKDOWN_EXTENSIONS.has(path.extname(absolutePath).toLowerCase())
  ) {
    return [];
  }
  const targetTree = parser.parse(readFileSync(absolutePath, "utf-8"));
  remarkMdxrDirectives()(targetTree, new VFile({ path: absolutePath }));
  const targetAnchors = anchorsOf(targetTree);
  let foundTitle = false;
  visit(targetTree, "heading", (heading) => {
    foundTitle ||= textContent(heading).trim() === section;
  });
  const matchesTitle = reference.section !== undefined && foundTitle;
  return targetAnchors.has(section) || matchesTitle
    ? []
    : [
        diagnosticAt(
          file,
          reference.node,
          "mdxr:missing-anchor",
          `Unknown section ${section} in ${reference.value}.`,
          reference.severity
        ),
      ];
};

const checkLocalReference = (
  reference: LocalReference,
  file: string,
  anchors: Set<string>
): DocumentDiagnostic[] => {
  const { node, severity, value } = reference;
  if (
    reference.literalPath !== true &&
    (urlScheme(value) !== undefined || value.startsWith("/"))
  ) {
    return [];
  }
  try {
    const { target, fragment } = referenceTarget(
      value,
      reference.literalPath === true
    );
    if (target === "") {
      return fragment !== "" && !anchors.has(fragment)
        ? [
            diagnosticAt(
              file,
              node,
              "mdxr:missing-anchor",
              `Unknown anchor #${fragment}.`,
              severity
            ),
          ]
        : [];
    }
    const absolutePath = path.resolve(
      path.dirname(reference.baseFile ?? file),
      target
    );
    const stats = statSync(absolutePath);
    if (reference.literalPath === true && !stats.isFile()) {
      throw new Error("not a regular file");
    }
    return [
      ...checkLines(reference, absolutePath, file),
      ...checkSection(
        reference,
        absolutePath,
        reference.section ?? fragment,
        file
      ),
    ];
  } catch (error) {
    return [
      diagnosticAt(
        file,
        node,
        "mdxr:local-reference",
        `Cannot resolve local reference ${value}: ${error instanceof Error ? error.message : String(error)}`,
        severity
      ),
    ];
  }
};

const referencesOf = (node: MdxTarget): LocalReference[] => {
  const references: LocalReference[] = [];
  const name = node.name ?? "";
  const localPath = jsxAttr(node, "path");
  if (
    localPath !== undefined &&
    (EMBEDDED_PATHS.has(name) || FILE_REFERENCES.has(name))
  ) {
    references.push({
      baseFile: name === "Include" ? node.data?.mdxrSourceFile : undefined,
      lines: name === "CodeFile" ? jsxAttr(node, "lines") : undefined,
      literalPath: true,
      node,
      section: jsxAttr(node, "section"),
      severity: EMBEDDED_PATHS.has(name) ? "error" : "warning",
      value: localPath,
    });
  }
  for (const attribute of ["src", "poster", "href"]) {
    const value = jsxAttr(node, attribute);
    if (value !== undefined) {
      references.push({ node, severity: "error", value });
    }
  }
  return references;
};

/** Static validation never evaluates document code, configuration, or React. */
export const checkSource = (
  source: string,
  filePath: string,
  components: ComponentMap = builtinComponents
): DocumentDiagnostic[] => {
  const file = new VFile({ path: filePath, value: source });
  const diagnostics: DocumentDiagnostic[] = [];
  try {
    matter(file);
    const tree = parser.parse(file);
    remarkNoJs({ collect: true })(tree, file);
    remarkMdxrDirectives()(tree, file);
    remarkMdxrAlerts()(tree);
    const checked = new WeakSet<Node>();
    const references: LocalReference[] = [];
    const inspect = (): void => {
      visit(tree, (node: Node) => {
        if (checked.has(node)) {
          return;
        }
        checked.add(node);
        if (JSX_ELEMENTS.has(node.type)) {
          diagnostics.push(...checkComponent(node, filePath, components));
          references.push(...referencesOf(node));
        } else if (
          (node.type === "link" ||
            node.type === "image" ||
            node.type === "definition") &&
          "url" in node &&
          typeof node.url === "string"
        ) {
          references.push({ node, severity: "error", value: node.url });
        }
      });
    };
    inspect();
    // Expansion uses the renderer's inclusion, section selection and cycle rules.
    if (!file.messages.some((message) => message.fatal === true)) {
      try {
        remarkInclude()(tree, file);
      } catch (error) {
        diagnostics.push(errorDiagnostic(filePath, error, "mdxr:include"));
      }
    }
    inspect();
    remarkReferences({ collect: true })(tree, file);
    const anchors = anchorsOf(tree);
    for (const reference of references) {
      diagnostics.push(...checkLocalReference(reference, filePath, anchors));
    }
    for (const message of file.messages) {
      diagnostics.push({
        ...errorDiagnostic(
          filePath,
          message,
          `mdxr:${message.ruleId ?? "syntax"}`
        ),
        severity: message.fatal === true ? "error" : "warning",
      });
    }
  } catch (error) {
    diagnostics.push(errorDiagnostic(filePath, error, "mdxr:syntax"));
  }
  return diagnostics;
};

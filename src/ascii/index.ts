/**
 * Plain-markdown rendering for mdxr documents: the same remark pipeline as
 * the HTML renderer parses the source, then every component element is
 * replaced by an ASCII/Markdown stand-in (status lists, block-art charts,
 * GFM tables, `<details>` disclosures) and the tree is serialized back to
 * Markdown. Output stays readable in any Markdown viewer — no HTML, no
 * hydration.
 */

import type { RootContent } from "mdast";
import { directiveToMarkdown } from "mdast-util-directive";
import { frontmatterToMarkdown } from "mdast-util-frontmatter";
import { gfmToMarkdown } from "mdast-util-gfm";
import { mathToMarkdown } from "mdast-util-math";
import { toMarkdown } from "mdast-util-to-markdown";
import remarkDirective from "remark-directive";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Node } from "unist";
import { VFile } from "vfile";
import { matter } from "vfile-matter";

import { formatError } from "../format-error.js";
import { isRecord } from "../guards.js";
import { remarkMdxrAlerts } from "../remark/alerts.js";
import { isParent } from "../remark/ast.js";
import { remarkCodeFile } from "../remark/code-file.js";
import { remarkCodeMeta } from "../remark/code-meta.js";
import { remarkMdxrDirectives } from "../remark/directives.js";
import { remarkFilePaths } from "../remark/file-paths.js";
import { remarkMdxrHeadings } from "../remark/headings.js";
import { remarkNoJs } from "../remark/no-js.js";
import { builtinComponents } from "../ui/index.js";
import { heading, named, para, transformAscii, txt } from "./ast.js";
import type { AsciiRegistry } from "./ast.js";
import { chartRenderers } from "./charts.js";
import { documentRenderers } from "./document.js";
import { formRenderers } from "./forms.js";
import { investigationRenderers } from "./investigation.js";
import { layoutRenderers } from "./layout.js";
import { outputRenderers } from "./output.js";
import { planningRenderers } from "./planning.js";
import { reportRenderers } from "./reports.js";
import { shadcnRenderers } from "./shadcn.js";

export const asciiRenderers: AsciiRegistry = {
  ...documentRenderers,
  ...planningRenderers,
  ...investigationRenderers,
  ...outputRenderers,
  ...reportRenderers,
  ...chartRenderers,
  ...layoutRenderers,
  ...formRenderers,
  ...shadcnRenderers,
};

/** Built-in names a renderer-less element may still be (e.g. shadcn chrome). */
const KNOWN = new Set(Object.keys(builtinComponents));

/** The HTML render path's remark pipeline, minus the JS compile step. */
const processor = unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(remarkFrontmatter)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkDirective)
  .use(remarkMdxrDirectives)
  .use(remarkMdxrAlerts)
  .use(remarkNoJs)
  .use(remarkMdxrHeadings)
  .use(remarkCodeFile)
  .use(remarkCodeMeta)
  .use(remarkFilePaths);

const EXTENSIONS = [
  gfmToMarkdown(),
  frontmatterToMarkdown("yaml"),
  mathToMarkdown(),
  // Directives not claimed by a component round-trip as `:::name` syntax.
  directiveToMarkdown(),
];

const serialize = (children: RootContent[]): string =>
  toMarkdown(
    { children, type: "root" },
    {
      bullet: "-",
      extensions: EXTENSIONS,
    }
  );

/** Frontmatter keys rendered on the synthesized header's meta line. */
const FM_KEYS: [string, string][] = [
  ["status", "Status"],
  ["date", "Date"],
  ["owner", "Owner"],
  ["version", "Version"],
  ["updated", "Updated"],
];

/** YAML scalars → display strings (`date:` parses to Date under vfile-matter). */
const fmStr = (v: unknown): string | undefined => {
  if (typeof v === "string") {
    return v === "" ? undefined : v;
  }
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  return typeof v === "number" ? String(v) : undefined;
};

/** Deep search for a component element by name (pre-transform tree). */
const contains = (nodes: Node[], name: string): boolean =>
  nodes.some(
    (n) => named(n, name) || (isParent(n) && contains(n.children, name))
  );

export interface AsciiResult {
  /** The document as plain Markdown — every component ASCII-rendered. */
  markdown: string;
  /**
   * Non-fatal diagnostics: unknown component names (their children still
   * render as text) plus remark warnings from the shared pipeline.
   */
  warnings: string[];
}

/**
 * Convert an MDX/MD document to readable Markdown. `filePath` anchors
 * relative file resolution (`<CodeFile>`, inline-code path chips) exactly
 * like `mdxToHtml`.
 */
export const mdxToAscii = async (
  source: string,
  filePath = "document.mdx"
): Promise<AsciiResult> => {
  const file = new VFile({ path: filePath, value: source });
  matter(file);
  const fmRaw: unknown = isRecord(file.data) ? file.data.matter : undefined;
  const fm: Record<string, unknown> = isRecord(fmRaw) ? fmRaw : {};

  const tree = processor.parse(file);
  await processor.run(tree, file);

  // The HTML render replaces frontmatter with a PlanHeader when a `title`
  // exists and no <Plan> supplies its own — mirror that so the header
  // survives in the text output too. Otherwise the yaml block stays.
  const hasPlan = contains(tree.children, "Plan");
  const title = fmStr(fm.title);
  if (title !== undefined && !hasPlan) {
    const meta = FM_KEYS.flatMap(([key, label]) => {
      const v = fmStr(fm[key]);
      return v === undefined ? [] : [`${label}: ${v}`];
    });
    const header: RootContent[] = [
      heading(1, [txt(title)]),
      ...(meta.length === 0 ? [] : [para([txt(meta.join(" · "))])]),
    ];
    const i = tree.children.findIndex((c) => c.type === "yaml");
    if (i === -1) {
      tree.children.unshift(...header);
    } else {
      tree.children.splice(i, 1, ...header);
    }
  }

  const unhandled = new Set<string>();
  transformAscii(tree, asciiRenderers, serialize, (name) => {
    // Registered-but-unrendered builtins (shadcn chrome) unwrap quietly;
    // anything else is a genuinely unknown element worth a warning.
    if (!KNOWN.has(name)) {
      unhandled.add(name);
    }
  });

  const markdown = serialize(tree.children);
  const warnings = [
    ...file.messages.map((m) => formatError(m)),
    ...[...unhandled].map(
      (n) => `unknown component <${n}> — kept as plain text`
    ),
  ];
  return { markdown, warnings };
};

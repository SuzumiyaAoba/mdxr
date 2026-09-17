import { existsSync } from "node:fs";
import path from "node:path";

import { evaluate } from "@mdx-js/mdx";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as runtime from "react/jsx-runtime";
import rehypeKatex from "rehype-katex";
import remarkDirective from "remark-directive";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { VFile } from "vfile";
import { matter } from "vfile-matter";

import type { ComponentMap } from "./define.js";
import { DocContext } from "./doc-context.js";
import { editorUrl } from "./editor.js";
import { isRecord } from "./guards.js";
import { rehypeShiki } from "./rehype/shiki.js";
import { remarkRvAlerts } from "./remark/alerts.js";
import { remarkCodeFile } from "./remark/code-file.js";
import { remarkCodeMeta } from "./remark/code-meta.js";
import { remarkRvDirectives } from "./remark/directives.js";
import { remarkRvHeadings } from "./remark/headings.js";
import { remarkNoJs } from "./remark/no-js.js";

export interface MdxResult {
  body: string;
  frontmatter: Record<string, unknown>;
}

const levenshtein = (a: string, b: string): number => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array.from({ length: b.length }, () => 0),
  ]);
  for (let j = 1; j <= b.length; j += 1) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
};

const enhanceRenderError = (
  err: unknown,
  components: ComponentMap
): unknown => {
  if (!(err instanceof Error)) {
    return err;
  }
  const m = /Expected component [`"'](?<name>\w+)[`"']/u.exec(err.message);
  const name = m?.groups?.name;
  if (name === undefined) {
    return err;
  }
  const names = Object.keys(components).filter((n) => /^[A-Z]/u.test(n));
  const [nearest] = names
    .map((n) => ({ d: levenshtein(name.toLowerCase(), n.toLowerCase()), n }))
    .toSorted((x, y) => x.d - y.d);
  const hint =
    nearest !== undefined && nearest.d <= 3
      ? ` Did you mean <${nearest.n}>?`
      : "";
  return new Error(
    `Unknown component <${name}>.${hint} Available: ${names.join(", ")}. Add custom components via rv.config.ts.`,
    { cause: err }
  );
};

export const mdxToHtml = async (
  source: string,
  components: ComponentMap,
  filePath = "document.mdx",
  opts: { editor?: string } = {}
): Promise<MdxResult> => {
  const file = new VFile({ path: filePath, value: source });
  matter(file);
  // vfile-matter sets `file.data.matter`, but its types don't declare it.
  const fmRaw: unknown = isRecord(file.data) ? file.data.matter : undefined;
  const frontmatter: Record<string, unknown> = isRecord(fmRaw) ? fmRaw : {};

  // Frontmatter `editor:` overrides the rv.config.ts default; "none" or an
  // unresolvable path disables the link. Only existing files get links.
  const editor =
    typeof frontmatter.editor === "string" && frontmatter.editor !== ""
      ? frontmatter.editor
      : opts.editor;
  const dir = file.dirname ?? ".";
  const fileLink = (rel: string, line?: string): string | undefined => {
    const abs = path.resolve(dir, rel);
    return existsSync(abs) ? editorUrl(editor, abs, line) : undefined;
  };

  const mod = await evaluate(file, {
    ...runtime,
    baseUrl: import.meta.url,
    format: "mdx",
    rehypePlugins: [rehypeKatex, rehypeShiki],
    remarkPlugins: [
      remarkFrontmatter,
      remarkGfm,
      remarkMath,
      remarkDirective,
      remarkRvDirectives,
      remarkRvAlerts,
      remarkNoJs,
      remarkRvHeadings,
      remarkCodeFile,
      remarkCodeMeta,
    ],
  });

  let body: string;
  try {
    body = renderToStaticMarkup(
      createElement(
        DocContext.Provider,
        { value: { fileLink } },
        createElement(mod.default, { components })
      )
    );
  } catch (error) {
    throw enhanceRenderError(error, components);
  }
  return { body, frontmatter };
};

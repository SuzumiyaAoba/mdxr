import { evaluate } from "@mdx-js/mdx";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as runtime from "react/jsx-runtime";
import remarkDirective from "remark-directive";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import { VFile } from "vfile";
import { matter } from "vfile-matter";

import type { ComponentMap } from "./define.js";
import { isRecord } from "./guards.js";
import { remarkRvAlerts } from "./remark/alerts.js";
import { remarkCodeMeta } from "./remark/code-meta.js";
import { remarkRvDirectives } from "./remark/directives.js";
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
  filePath = "document.mdx"
): Promise<MdxResult> => {
  const file = new VFile({ path: filePath, value: source });
  matter(file);

  const mod = await evaluate(file, {
    ...runtime,
    baseUrl: import.meta.url,
    format: "mdx",
    remarkPlugins: [
      remarkFrontmatter,
      remarkGfm,
      remarkDirective,
      remarkRvDirectives,
      remarkRvAlerts,
      remarkNoJs,
      remarkCodeMeta,
    ],
  });

  let body: string;
  try {
    body = renderToStaticMarkup(createElement(mod.default, { components }));
  } catch (error) {
    throw enhanceRenderError(error, components);
  }
  // vfile-matter sets `file.data.matter`, but its types don't declare it.
  const fm: unknown = isRecord(file.data) ? file.data.matter : undefined;
  return {
    body,
    frontmatter: isRecord(fm) ? fm : {},
  };
};

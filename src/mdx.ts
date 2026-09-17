import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { compile } from "@mdx-js/mdx";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import rehypeKatex from "rehype-katex";
import remarkDirective from "remark-directive";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { VFile } from "vfile";
import { matter } from "vfile-matter";

import type { AnyComponent, ComponentMap } from "./define.js";
import { DocContext } from "./doc-context.js";
import { editorUrl } from "./editor.js";
import { isRecord } from "./guards.js";
import { cacheDir } from "./paths.js";
import { rehypeShiki } from "./rehype/shiki.js";
import { remarkMdxrAlerts } from "./remark/alerts.js";
import { remarkCodeFile } from "./remark/code-file.js";
import { remarkCodeMeta } from "./remark/code-meta.js";
import { remarkMdxrDirectives } from "./remark/directives.js";
import { remarkFilePaths } from "./remark/file-paths.js";
import { remarkMdxrHeadings } from "./remark/headings.js";
import { remarkNoJs } from "./remark/no-js.js";
import { takeUsedIcons } from "./ui/icon.js";

export interface MdxResult {
  body: string;
  frontmatter: Record<string, unknown>;
  /**
   * Compiled MDX module source (ESM, `react/jsx-runtime` imports). The same
   * module is rendered here and re-bundled into the document's hydration
   * script, so client and server evaluate identical code.
   */
  code: string;
  /**
   * Every `fileLink(rel, line)` call made during SSR, keyed `rel\0line`. The
   * hydration bundle replays these so components see identical link results
   * (no `existsSync` in the browser).
   */
  fileLinks: Record<string, string>;
  /**
   * Iconify names (`prefix:name`) resolved while rendering — the hydration
   * bundle registers exactly this subset instead of the full icon sets.
   */
  usedIcons: string[];
  /**
   * Catalog keys the compiled document references — the hydrate import list.
   * Extracted from the emitted module rather than observed at render: the
   * module spreads `props.components`, so proxy-based tracking would record
   * every catalog key.
   */
  usedComponents: string[];
}

const isComponent = (v: unknown): v is AnyComponent => typeof v === "function";

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
    `Unknown component <${name}>.${hint} Available: ${names.join(", ")}. Add custom components via mdxr.config.ts.`,
    { cause: err }
  );
};

/**
 * Import a compiled MDX module. Written into this package's cache dir so its
 * `react/jsx-runtime` import resolves to our copy — the same instance the
 * hydration bundle pins via its resolve plugin.
 */
const importCompiled = async (
  code: string
): Promise<Record<string, unknown>> => {
  await mkdir(cacheDir, { recursive: true });
  const hash = createHash("sha256").update(code).digest("hex").slice(0, 12);
  const out = path.join(cacheDir, `doc-${hash}.mjs`);
  if (!existsSync(out)) {
    await writeFile(out, code);
  }
  const raw: unknown = await import(pathToFileURL(out).href);
  return isRecord(raw) ? raw : {};
};

/**
 * Which catalog entries the document references is visible in the compiled
 * module itself: JSX identifiers become `_missingMdxReference("Name", …)`
 * checks, markdown element overrides read `_components.name`, and a `wrapper`
 * entry is picked straight off `props.components`. (Spreading `components`
 * into `_components` makes runtime tracking see every key — hence static
 * extraction here instead.)
 */
const extractUsedComponents = (
  code: string,
  components: ComponentMap
): string[] => {
  const catalogKeys = new Set(Object.keys(components));
  const used = new Set<string>();
  for (const m of code.matchAll(/_missingMdxReference\("(?<name>[^"]+)"/gu)) {
    const name = m.groups?.name;
    if (name !== undefined && catalogKeys.has(name)) {
      used.add(name);
    }
  }
  for (const m of code.matchAll(
    /_components\.(?<dot>\w+)|_components\["(?<bracket>[^"]+)"\]/gu
  )) {
    const name = m.groups?.dot ?? m.groups?.bracket;
    if (name !== undefined && catalogKeys.has(name)) {
      used.add(name);
    }
  }
  if (catalogKeys.has("wrapper")) {
    used.add("wrapper");
  }
  return [...used];
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

  // Frontmatter `editor:` overrides the mdxr.config.ts default; "none" or an
  // unresolvable path disables the link. Only existing files get links.
  const editor =
    typeof frontmatter.editor === "string" && frontmatter.editor !== ""
      ? frontmatter.editor
      : opts.editor;
  const dir = file.dirname ?? ".";
  // Calls are recorded so the hydration bundle can replay identical results —
  // the client has no filesystem, so a missing map entry means "no link".
  const fileLinks = new Map<string, string>();
  const fileLink = (rel: string, line?: string): string | undefined => {
    const abs = path.resolve(dir, rel);
    const url = existsSync(abs) ? editorUrl(editor, abs, line) : undefined;
    if (url !== undefined) {
      // NUL separator — `rel` may legitimately end in digits, and the client
      // lookup in hydrate.ts uses the same key shape.
      fileLinks.set(`${rel}\0${line ?? ""}`, url);
    }
    return url;
  };

  // Compile once: the emitted module is imported for SSR *and* inlined into
  // the hydration bundle, so both sides run byte-identical document code.
  const compiled = await compile(file, {
    baseUrl: import.meta.url,
    format: "mdx",
    rehypePlugins: [rehypeKatex, rehypeShiki],
    remarkPlugins: [
      remarkFrontmatter,
      remarkGfm,
      remarkMath,
      remarkDirective,
      remarkMdxrDirectives,
      remarkMdxrAlerts,
      remarkNoJs,
      remarkMdxrHeadings,
      remarkCodeFile,
      remarkCodeMeta,
      remarkFilePaths,
    ],
  });
  const code = String(compiled);
  const mod = await importCompiled(code);

  const used = extractUsedComponents(code, components);

  const docComponent = mod.default;
  if (!isComponent(docComponent)) {
    throw new Error("Compiled document has no default export component.");
  }

  takeUsedIcons();
  let body: string;
  try {
    body = renderToStaticMarkup(
      createElement(
        DocContext.Provider,
        { value: { fileLink } },
        createElement(docComponent, { components })
      )
    );
  } catch (error) {
    throw enhanceRenderError(error, components);
  }
  return {
    body,
    code,
    fileLinks: Object.fromEntries(fileLinks),
    frontmatter,
    usedComponents: used,
    usedIcons: takeUsedIcons(),
  };
};

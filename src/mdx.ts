import { existsSync } from "node:fs";
import path from "node:path";

import { compile } from "@mdx-js/mdx";
import { createElement, Fragment } from "react";
import type { ReactElement } from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import rehypeKatex from "rehype-katex";
import remarkDirective from "remark-directive";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { VFile } from "vfile";
import { matter } from "vfile-matter";

import type { AnnotationSource } from "./annotations.js";
import type { ComponentMap } from "./define.js";
import type { DocContextValue } from "./doc-context.js";
import { DocContext } from "./doc-context.js";
import { editorUrl } from "./editor.js";
import { enhanceRenderError, formatError } from "./format-error.js";
import { isComponent, isRecord } from "./guards.js";
import { importBundledCode } from "./load-user-module.js";
import { rehypeShiki } from "./rehype/shiki.js";
import { remarkMdxrAlerts } from "./remark/alerts.js";
import { remarkAnnotationSources } from "./remark/annotation-sources.js";
import { remarkCodeFile } from "./remark/code-file.js";
import { remarkCodeMeta } from "./remark/code-meta.js";
import { remarkMdxrDirectives } from "./remark/directives.js";
import { remarkFilePaths } from "./remark/file-paths.js";
import { remarkMdxrHeadings } from "./remark/headings.js";
import { remarkInclude } from "./remark/include.js";
import { remarkNoJs } from "./remark/no-js.js";
import { remarkDocumentPages } from "./remark/pages.js";
import { remarkReferences } from "./remark/references.js";
import { remarkSectionReviews } from "./remark/section-reviews.js";
import { takeUsedIcons } from "./ui/icon.js";

export interface MdxResult {
  annotationSources: AnnotationSource[];
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
  /**
   * ISO timestamp captured at render time and put in `DocContext.now` —
   * serialized into the hydration spec so relative-time components render
   * identically on the client.
   */
  renderedAt: string;
  /**
   * The context value the body was rendered under — anything rendered next to
   * it (the frontmatter PlanHeader) must use the same Provider or hydration
   * sees different context.
   */
  context: DocContextValue;
  /** True when the body was rendered for hydration (renderToString). */
  hydrated: boolean;
  /**
   * Re-render the document with `header` as the first child of the same
   * Provider > Fragment > [header|null, doc] tree the hydration client
   * mounts (hydrate-runtime's mountDocument). useId() encodes tree position,
   * so the header must be rendered inside that shape — prepending separately
   * rendered markup would shift every hydrated id/name/htmlFor. Returns
   * fresh snapshots too: the pass replays every fileLink/icon lookup.
   */
  renderWithHeader: (header: ReactElement) => {
    fileLinks: Record<string, string>;
    html: string;
    usedIcons: string[];
  };
}

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
  opts: { editor?: string; hydrate?: boolean } = {}
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
      remarkInclude,
      remarkMdxrAlerts,
      remarkNoJs,
      remarkMdxrHeadings,
      remarkCodeFile,
      remarkCodeMeta,
      remarkFilePaths,
      remarkReferences,
      remarkAnnotationSources,
      remarkDocumentPages,
      remarkSectionReviews,
    ],
  });
  // Non-fatal plugin diagnostics (unknown directives, …) reach the user here.
  for (const m of compiled.messages) {
    process.stderr.write(`mdxr: warning: ${formatError(m)}\n`);
  }
  const code = String(compiled);
  // The compiled module is imported from this package's cache dir so its
  // `react/jsx-runtime` resolves to our copy — the same instance the
  // hydration bundle pins via its resolve plugin.
  const mod = await importBundledCode(code, "doc");

  const used = extractUsedComponents(code, components);

  const docComponent = mod.default;
  if (!isComponent(docComponent)) {
    throw new Error("Compiled document has no default export component.");
  }

  takeUsedIcons();
  const renderedAt = new Date();
  const context: DocContextValue = { fileLink, now: renderedAt };
  // hydrateRoot reconciles against markup produced by renderToString — its
  // `<!-- -->` text-boundary comments keep adjacent text expressions from
  // merging in the DOM. renderToStaticMarkup omits them, so only purely
  // static documents use it.
  const hydrated = (opts.hydrate ?? true) && used.length > 0;
  const renderToMarkup = hydrated ? renderToString : renderToStaticMarkup;
  // The client mounts Provider > Fragment > [header|null, doc]. SSR must emit
  // that exact shape: useId() seeds encode a component's position in the
  // tree, so rendering `doc` directly would diverge from hydration even with
  // no header (the extra Fragment level changes the generated ids).
  const renderDocument = (header: ReactElement | null): string =>
    renderToMarkup(
      createElement(
        DocContext.Provider,
        { value: context },
        createElement(
          Fragment,
          null,
          header,
          createElement(docComponent, { components })
        )
      )
    );
  let body: string;
  try {
    body = renderDocument(null);
  } catch (error) {
    throw enhanceRenderError(error, Object.keys(components));
  }
  return {
    annotationSources: compiled.data.annotationSources ?? [],
    body,
    code,
    context,
    fileLinks: Object.fromEntries(fileLinks),
    frontmatter,
    hydrated,
    renderWithHeader: (header) => {
      try {
        const html = renderDocument(header);
        return {
          fileLinks: Object.fromEntries(fileLinks),
          html,
          usedIcons: takeUsedIcons(),
        };
      } catch (error) {
        throw enhanceRenderError(error, Object.keys(components));
      }
    },
    renderedAt: renderedAt.toISOString(),
    usedComponents: used,
    usedIcons: takeUsedIcons(),
  };
};

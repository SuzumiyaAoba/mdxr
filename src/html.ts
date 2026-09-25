import { icons as lucide } from "@iconify-json/lucide";

import { ANNOTATION_HIGHLIGHT_CSS, annotationHtml } from "./annotation-html.js";
import type { AnnotationDocument } from "./annotations.js";
import {
  KATEX_CDN_URL,
  LIVE_RELOAD_JS,
  MERMAID_JS,
  THEME_JS,
} from "./assets/scripts.js";

/**
 * JS destined for an inline `<script>` element: neutralize the two byte
 * sequences the HTML parser treats specially (`</script` ends the element,
 * `<!--` opens a comment escape). `\u003C` keeps the meaning in strings,
 * comments, and regex literals alike. Applied centrally here so every
 * snippet — authored constants, the client bundle, the hydrate bundle —
 * is safe regardless of its producer.
 */
export const inlineScript = (js: string): string =>
  js
    .replaceAll(/<\/script/giu, "\\u003C/script")
    .replaceAll("<!--", "\\u003C!--");

/**
 * Inline `<style>` content: a `</style` byte sequence inside the CSS (e.g. a
 * `content:` string in user theme CSS) would end the element early. `<\/`
 * reads identically inside CSS strings/comments, so it's safe to emit.
 */
export const inlineStyle = (css: string): string =>
  css.replaceAll(/<\/style/giu, "<\\/style");

const ESCAPES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};

const escapeHtml = (s: string): string =>
  s.replaceAll(/[&<>"']/gu, (c) => ESCAPES[c] ?? c);

/** Inline SVG from the bundled lucide set (bodies carry stroke attrs). */
const iconSvg = (name: string): string => {
  const icon = lucide.icons[name];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 ${icon?.width ?? 24} ${icon?.height ?? 24}" class="lucide" aria-hidden="true">${icon?.body ?? ""}</svg>`;
};

/**
 * Theme toggle button — document chrome fixed to the top-right corner.
 * `data-mode` selects the visible icon (auto → light → dark, cycled by
 * `handleDocEvent`); THEME_JS restores the stored choice before paint.
 */
const THEME_TOGGLE_HTML = `<button type="button" class="mdxr-theme" data-mdxr-theme data-mode="auto" title="Theme: auto" aria-label="Switch theme (current: auto)"><span class="mdxr-theme-i mdxr-theme-i-auto">${iconSvg("sun-moon")}</span><span class="mdxr-theme-i mdxr-theme-i-light">${iconSvg("sun")}</span><span class="mdxr-theme-i mdxr-theme-i-dark">${iconSvg("moon")}</span></button>`;

export interface DocumentOptions {
  annotations?: AnnotationDocument;
  title: string;
  body: string;
  css: string;
  /** Vanilla client bundle from `clientJs()` (copy/ask/theme handlers). */
  clientJs: string;
  needsMermaid: boolean;
  needsKatex?: boolean;
  liveReload?: boolean;
  /**
   * Client bundle that `hydrateRoot`s the compiled MDX module onto
   * `<main id="mdxr-root">`, making Base UI primitives interactive.
   */
  hydrateJs?: string;
}

export const htmlDocument = (o: DocumentOptions): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="mdxr">
<title>${escapeHtml(o.title)}</title>
<script>${inlineScript(THEME_JS)}</script>
${o.needsKatex === true ? `<link rel="stylesheet" href="${KATEX_CDN_URL}">` : ""}
<style>${inlineStyle(o.css)}${o.annotations === undefined ? "" : ANNOTATION_HIGHLIGHT_CSS}</style>
</head>
<body class="bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
${THEME_TOGGLE_HTML}
<main id="mdxr-root" class="prose prose-neutral dark:prose-invert mx-auto max-w-3xl px-6 py-10">${o.body}</main>
${o.annotations === undefined ? "" : `${annotationHtml(iconSvg)}<script type="application/json" id="mdxr-annotation-document">${JSON.stringify(o.annotations).replaceAll("<", "\\u003c")}</script>`}
<script>${inlineScript(o.clientJs)}</script>
${o.needsMermaid ? `<script type="module">${inlineScript(MERMAID_JS)}</script>` : ""}
${o.liveReload === true ? `<script>${inlineScript(LIVE_RELOAD_JS)}</script>` : ""}
${o.hydrateJs === undefined ? "" : `<script>${inlineScript(o.hydrateJs)}</script>`}
</body>
</html>
`;

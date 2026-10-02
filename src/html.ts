import { icons as lucide } from "@iconify-json/lucide";

import { ANNOTATION_HIGHLIGHT_CSS, annotationHtml } from "./annotation-html.js";
import type { AnnotationDocument } from "./annotations.js";
import {
  KATEX_CDN_URL,
  LIVE_RELOAD_JS,
  MERMAID_JS,
  THEME_JS,
} from "./assets/scripts.js";
import { sectionReviewHtml } from "./section-review-html.js";

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
    .replaceAll(/<\/script/giu, (match) => `\\u003C${match.slice(1)}`)
    .replaceAll("<!--", "\\u003C!--");

/**
 * Inline `<style>` content: a `</style` byte sequence inside the CSS (e.g. a
 * `content:` string in user theme CSS) would end the element early. `<\/`
 * reads identically inside CSS strings/comments, so it's safe to emit.
 */
export const inlineStyle = (css: string): string =>
  css.replaceAll(/<\/style/giu, (match) => `<\\${match.slice(1)}`);

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
const THEME_TOGGLE_HTML = `<button type="button" class="doc-theme" data-doc-theme data-mode="auto" title="Theme: auto" aria-label="Switch theme (current: auto)"><span class="doc-theme-i doc-theme-i-auto">${iconSvg("sun-moon")}</span><span class="doc-theme-i doc-theme-i-light">${iconSvg("sun")}</span><span class="doc-theme-i doc-theme-i-dark">${iconSvg("moon")}</span></button>`;

export interface DocumentOptions {
  annotations?: AnnotationDocument;
  documentControls?: boolean;
  title: string;
  body: string;
  css: string;
  /**
   * Initial effective theme for script-blocked previews. THEME_JS can change
   * the class after first paint when scripts are enabled.
   */
  initialTheme?: "light" | "dark";
  /** Vanilla client bundle from `clientJs()` (copy/ask/theme handlers). */
  clientJs: string;
  needsMermaid: boolean;
  needsKatex?: boolean;
  liveReload?: boolean;
  /**
   * Client bundle that `hydrateRoot`s the compiled MDX module onto
   * `<main id="doc-root">`, making Base UI primitives interactive.
   */
  hydrateJs?: string;
  linkedDocuments?: Record<string, { html: string; path: string }>;
}

export const htmlDocument = (o: DocumentOptions): string => {
  const annotations = o.documentControls === false ? undefined : o.annotations;
  return `<!doctype html>
<html lang="en"${
    o.initialTheme === undefined
      ? ""
      : ` class="${o.initialTheme}" style="color-scheme: ${o.initialTheme}"`
  }>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(o.title)}</title>
${o.documentControls === false ? "" : `<script>${inlineScript(THEME_JS)}</script>`}
${o.needsKatex === true ? `<link rel="stylesheet" href="${KATEX_CDN_URL}">` : ""}
<style>${inlineStyle(o.css)}${annotations === undefined ? "" : ANNOTATION_HIGHLIGHT_CSS}</style>
</head>
<body class="bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
${
  o.documentControls === false
    ? ""
    : `${THEME_TOGGLE_HTML}
<div class="doc-view-controls" role="group" aria-label="Document view" hidden>
<button type="button" data-doc-view="document" aria-pressed="true">${iconSvg("file-text")}<span>Document</span></button>
<button type="button" data-doc-view="pages" aria-pressed="false">${iconSvg("panel-left")}<span>Pages</span></button>
</div>
<aside class="doc-pages" aria-label="Document pages" hidden>
<p class="doc-pages-title">${escapeHtml(o.title)}</p>
<p data-section-review-summary role="status" hidden></p>
<div data-doc-page-tabs role="tablist" aria-label="Sections" aria-orientation="vertical"></div>
</aside>`
}
<div id="doc-content">
<main id="doc-root" class="prose prose-neutral dark:prose-invert mx-auto max-w-3xl px-6 py-10">${o.body}</main>
${
  o.documentControls === false
    ? ""
    : `<nav class="doc-page-navigation" aria-label="Section navigation" hidden>
<button type="button" data-doc-page-previous>${iconSvg("chevron-left")}<span class="doc-page-navigation-labels"><span>Previous</span><span data-doc-page-previous-title hidden></span></span></button>
<button type="button" data-doc-page-next><span class="doc-page-navigation-labels"><span>Next</span><span data-doc-page-next-title hidden></span></span>${iconSvg("chevron-right")}</button>
</nav>`
}
</div>
${annotations === undefined ? "" : `${annotationHtml(iconSvg)}<script type="application/json" id="doc-annotation-document">${JSON.stringify(annotations).replaceAll("<", "\\u003c")}</script>`}
${annotations === undefined ? "" : sectionReviewHtml(iconSvg)}
${o.linkedDocuments === undefined || Object.keys(o.linkedDocuments).length === 0 ? "" : `<script type="application/json" id="doc-linked-documents">${JSON.stringify(o.linkedDocuments).replaceAll("<", "\\u003c")}</script>`}
<script data-doc-hydration="${o.hydrateJs === undefined ? "false" : "true"}">${inlineScript(o.clientJs)}</script>
${o.needsMermaid ? `<script type="module">${inlineScript(MERMAID_JS)}</script>` : ""}
${o.liveReload === true ? `<script>${inlineScript(LIVE_RELOAD_JS)}</script>` : ""}
${o.hydrateJs === undefined ? "" : `<script>${inlineScript(o.hydrateJs)}</script>`}
</body>
</html>
`;
};

import { icons as lucide } from "@iconify-json/lucide";

import {
  CLIENT_JS,
  KATEX_CDN_URL,
  LIVE_RELOAD_JS,
  MERMAID_JS,
  THEME_JS,
} from "./assets.js";

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
const THEME_TOGGLE_HTML = `<button type="button" class="rv-theme" data-rv-theme data-mode="auto" title="Theme: auto" aria-label="Switch theme (current: auto)"><span class="rv-theme-i rv-theme-i-auto">${iconSvg("sun-moon")}</span><span class="rv-theme-i rv-theme-i-light">${iconSvg("sun")}</span><span class="rv-theme-i rv-theme-i-dark">${iconSvg("moon")}</span></button>`;

export interface DocumentOptions {
  title: string;
  body: string;
  css: string;
  needsMermaid: boolean;
  needsKatex?: boolean;
  liveReload?: boolean;
}

export const htmlDocument = (o: DocumentOptions): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="rv">
<title>${escapeHtml(o.title)}</title>
<script>${THEME_JS}</script>
${o.needsKatex === true ? `<link rel="stylesheet" href="${KATEX_CDN_URL}">` : ""}
<style>${o.css}</style>
</head>
<body class="bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
${THEME_TOGGLE_HTML}
<main class="prose prose-neutral dark:prose-invert mx-auto max-w-3xl px-6 py-10">
${o.body}
</main>
<script>${CLIENT_JS}</script>
${o.needsMermaid ? `<script type="module">${MERMAID_JS}</script>` : ""}
${o.liveReload === true ? `<script>${LIVE_RELOAD_JS}</script>` : ""}
</body>
</html>
`;

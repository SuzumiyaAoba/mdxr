/**
 * Inline script snippets emitted into rendered documents. Each is a plain
 * authored string (unlike the client bundle, which `client-js.ts` builds
 * from `src/client/`). htmlDocument escapes them for inline `<script>`
 * embedding — keep that in mind before adding `</` sequences here.
 */

/**
 * Mermaid is always imported from the CDN at runtime — never bundled into
 * documents or the Storybook bundle. Shared so the preview uses the same
 * build as rendered documents.
 */
export const MERMAID_CDN_URL =
  "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";

/** Mermaid bootstrap (module). Only injected when the document uses it. */
export const MERMAID_JS = `
import mermaid from '${MERMAID_CDN_URL}';
mermaid.initialize({
  startOnLoad: false,
  theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default',
});
await mermaid.run({ nodes: document.querySelectorAll('.mermaid') });
`;

/**
 * KaTeX stylesheet (fonts resolve relative to this URL on the CDN). Only
 * linked when the document contains math — same CDN-on-demand model as
 * mermaid. Version matches the bundled `katex` dependency.
 */
export const KATEX_CDN_URL =
  "https://cdn.jsdelivr.net/npm/katex@0.18.7/dist/katex.min.css";

/** Live-reload snippet injected by `mdxr serve` only. */
export const LIVE_RELOAD_JS = `
var es = new EventSource('/__mdxr_events');
es.addEventListener('reload', function () { location.reload(); });
`;

/**
 * The shadcn theme maps `dark:` to the `.dark` class, so dark mode is
 * class-based rather than media-based. This head script applies the class
 * before first paint: a stored choice from the theme toggle
 * (localStorage `mdxr-theme`) wins, otherwise the document tracks
 * `prefers-color-scheme` — and keeps tracking it only while no explicit
 * choice is stored.
 */
export const THEME_JS = `
var q = matchMedia('(prefers-color-scheme: dark)');
var stored = null;
try { stored = localStorage.getItem('mdxr-theme'); } catch (e) {}
var root = document.documentElement;
var mode = stored === 'light' || stored === 'dark' ? stored : 'auto';
var applyTheme = function (selectedMode, systemDark) {
  var dark = selectedMode === 'dark' || (selectedMode === 'auto' && systemDark);
  root.classList.remove('light');
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
};
root.dataset.mdxrThemeMode = mode;
applyTheme(mode, q.matches);
q.addEventListener('change', function (e) {
  var currentMode = root.dataset.mdxrThemeMode || 'auto';
  if (currentMode === 'auto') {
    applyTheme(currentMode, e.matches);
  }
});
// This script runs in <head>, before the toggle button is parsed —
// reflect the stored mode on it once the DOM exists.
addEventListener('DOMContentLoaded', function () {
  var currentMode = root.dataset.mdxrThemeMode || 'auto';
  document.querySelectorAll('[data-mdxr-theme]').forEach(function (b) {
    if (!(b instanceof HTMLElement)) {
      return;
    }
    if (b.hasAttribute('data-mdxr-theme-react')) {
      return;
    }
    b.dataset.mode = currentMode;
    b.setAttribute('title', 'Theme: ' + currentMode);
    b.setAttribute('aria-label', 'Switch theme (current: ' + currentMode + ')');
  });
});
`;

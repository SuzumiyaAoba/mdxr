import { CLIENT_JS, LIVE_RELOAD_JS, MERMAID_JS, THEME_JS } from "./assets.js";

const ESCAPES: Record<string, string> = {
  '"': "&quot;",
  "&": "&amp;",
  "'": "&#39;",
  "<": "&lt;",
  ">": "&gt;",
};

const escapeHtml = (s: string): string =>
  s.replaceAll(/[&<>"']/gu, (c) => ESCAPES[c] ?? c);

export interface DocumentOptions {
  title: string;
  body: string;
  css: string;
  needsMermaid: boolean;
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
<style>${o.css}</style>
</head>
<body class="bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
<main class="prose prose-neutral dark:prose-invert mx-auto max-w-3xl px-6 py-10">
${o.body}
</main>
<script>${CLIENT_JS}</script>
${o.needsMermaid ? `<script type="module">${MERMAID_JS}</script>` : ""}
${o.liveReload === true ? `<script>${LIVE_RELOAD_JS}</script>` : ""}
</body>
</html>
`;

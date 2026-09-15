/** Base CSS appended after Tailwind utilities (covers what utilities can't). */
export const BASE_CSS = `
.task-list-item { list-style: none; }
ul.contains-task-list { padding-left: 1.25rem; }
.task-list-item input[type='checkbox'] { margin-right: 0.4em; }
.rv-copy.copied { opacity: 1; }
`;

/** Small vanilla JS inlined into every document: copy buttons + mermaid. */
export const CLIENT_JS = `
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-copy]');
  if (!b) return;
  navigator.clipboard.writeText(b.getAttribute('data-copy'));
  b.classList.add('copied');
  setTimeout(function () { b.classList.remove('copied'); }, 1200);
});
`;

/** Mermaid bootstrap (module). Only injected when the document uses it. */
export const MERMAID_JS = `
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
mermaid.initialize({
  startOnLoad: false,
  theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default',
});
await mermaid.run({ nodes: document.querySelectorAll('.mermaid') });
`;

/** Live-reload snippet injected by \`rv serve\` only. */
export const LIVE_RELOAD_JS = `
var es = new EventSource('/__rv_events');
es.addEventListener('reload', function () { location.reload(); });
`;

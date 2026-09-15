/** Base CSS appended after Tailwind utilities (covers what utilities can't). */
export const BASE_CSS = `
.task-list-item { list-style: none; }
ul.contains-task-list { padding-left: 1.25rem; }
.task-list-item input[type='checkbox'] { margin-right: 0.4em; }
.rv-copy.copied { opacity: 1; }
`;

/**
 * Delegated click handler for `[data-copy]` buttons. Inlined into documents
 * via `CLIENT_JS` (`toString`) and registered by the Storybook preview, so it
 * must stay self-contained — no imports, no outer-scope references.
 */
export const handleCopyClick = (e: MouseEvent): void => {
  const el = e.target;
  const b = el instanceof Element ? el.closest("[data-copy]") : null;
  if (!(b instanceof HTMLElement)) {
    return;
  }
  const text = b.dataset.copy ?? "";
  const markCopied = (): void => {
    b.classList.add("copied");
    setTimeout(() => {
      b.classList.remove("copied");
    }, 1200);
  };
  const legacy = (): boolean => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      // oxlint-disable-next-line typescript/no-deprecated -- only fallback outside secure contexts
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  };
  // navigator.clipboard is absent outside secure contexts (e.g. file://).
  const clip = navigator.clipboard as Clipboard | undefined;
  if (clip === undefined) {
    if (legacy()) {
      markCopied();
    }
    return;
  }
  void (async () => {
    try {
      await clip.writeText(text);
      markCopied();
    } catch {
      if (legacy()) {
        markCopied();
      }
    }
  })();
};

/** Small vanilla JS inlined into every document: copy buttons + mermaid. */
export const CLIENT_JS = `document.addEventListener('click', ${handleCopyClick.toString()});`;

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

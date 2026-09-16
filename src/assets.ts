/** Base CSS appended after Tailwind utilities (covers what utilities can't). */
export const BASE_CSS = `
.task-list-item { list-style: none; }
ul.contains-task-list { padding-left: 1.25rem; }
.task-list-item input[type='checkbox'] { margin-right: 0.4em; }
.rv-copy.copied { opacity: 1; }
/* shiki dual-theme: token spans carry --shiki-* variables, not colors. */
.shiki span {
  color: var(--shiki-light);
  font-style: var(--shiki-light-font-style, normal);
  font-weight: var(--shiki-light-font-weight, normal);
  text-decoration: var(--shiki-light-text-decoration, none);
}
@media (prefers-color-scheme: dark) {
  .shiki span {
    color: var(--shiki-dark);
    font-style: var(--shiki-dark-font-style, normal);
    font-weight: var(--shiki-dark-font-weight, normal);
    text-decoration: var(--shiki-dark-text-decoration, none);
  }
}
/* The .dark class (set by THEME_JS in documents, the toolbar in Storybook)
 * wins over the media query so toggling it re-themes code blocks too. */
.dark .shiki span {
  color: var(--shiki-dark);
  font-style: var(--shiki-dark-font-style, normal);
  font-weight: var(--shiki-dark-font-weight, normal);
  text-decoration: var(--shiki-dark-text-decoration, none);
}
html:not(.dark) .shiki span {
  color: var(--shiki-light);
  font-style: var(--shiki-light-font-style, normal);
  font-weight: var(--shiki-light-font-weight, normal);
  text-decoration: var(--shiki-light-text-decoration, none);
}
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

/** Live-reload snippet injected by \`rv serve\` only. */
export const LIVE_RELOAD_JS = `
var es = new EventSource('/__rv_events');
es.addEventListener('reload', function () { location.reload(); });
`;

/**
 * The shadcn theme maps `dark:` to the `.dark` class, so dark mode is
 * class-based rather than media-based. This head script applies the class
 * before first paint and tracks system theme changes.
 */
export const THEME_JS = `
var q = matchMedia('(prefers-color-scheme: dark)');
document.documentElement.classList.toggle('dark', q.matches);
q.addEventListener('change', function (e) {
  document.documentElement.classList.toggle('dark', e.matches);
});
`;

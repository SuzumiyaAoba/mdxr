/** Base CSS appended after Tailwind utilities (covers what utilities can't). */
export const BASE_CSS = `
/* Preflight makes <svg> display:block, which splits inline text around
 * icons; Iconify svgs (.iconify) and lucide-react svgs (.lucide) stay inline. */
.iconify, .lucide { display: inline-block; }
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
/* Line-level features: fences carry has-* classes on <code>; .line spans
 * become blocks so bands/numbers span the block width. The pre's p-4 (1rem)
 * is mirrored here so highlight bands bleed to the block edge. */
.shiki .line { display: block; margin: 0 -1rem; padding: 0 1rem; }
.shiki .line.highlighted { background: rgba(14, 165, 233, 0.1); }
.dark .shiki .line.highlighted { background: rgba(14, 165, 233, 0.16); }
.shiki .line.diff.add { background: rgba(16, 185, 129, 0.12); }
.shiki .line.diff.remove { background: rgba(239, 68, 68, 0.1); }
.dark .shiki .line.diff.add { background: rgba(16, 185, 129, 0.18); }
.dark .shiki .line.diff.remove { background: rgba(239, 68, 68, 0.16); }
.shiki .line.diff.add::before,
.shiki .line.diff.remove::before {
  display: inline-block; width: 1em; margin-right: 0.5em;
  color: rgba(113, 113, 122, 0.8); user-select: none;
}
.shiki .line.diff.add::before { content: '+'; }
.shiki .line.diff.remove::before { content: '−'; }
.shiki .line.error { background: rgba(239, 68, 68, 0.12); }
.shiki .line.warning { background: rgba(245, 158, 11, 0.14); }
.dark .shiki .line.error { background: rgba(239, 68, 68, 0.2); }
.dark .shiki .line.warning { background: rgba(245, 158, 11, 0.18); }
.shiki code.has-focused .line:not(.focused) { opacity: 0.4; }
.shiki .line.focused { opacity: 1; }
.shiki span.highlighted-word {
  background: rgba(245, 158, 11, 0.18); border-radius: 0.2rem;
  outline: 1px solid rgba(245, 158, 11, 0.35); padding: 0 0.1rem;
}
.shiki code.has-line-numbers { counter-reset: rv-line; }
.shiki code.has-line-numbers .line::before {
  counter-increment: rv-line; content: counter(rv-line);
  display: inline-block; width: 1.8em; margin-right: 1em;
  text-align: right; color: rgba(113, 113, 122, 0.6); user-select: none;
}
.shiki code.has-line-numbers .line.diff.add::before,
.shiki code.has-line-numbers .line.diff.remove::before {
  content: counter(rv-line); /* numbers win over the +/− gutter marker */
}
/* KaTeX display math gets a little breathing room. */
.katex-display { margin: 1.25rem 0; }
/* Smooth anchor jumps for the ToC and other in-page links. */
html { scroll-behavior: smooth; }
/* Native <details> used by Toc/Details: drop the default marker, rotate the
 * chevron on open. */
.rv-toc > details > summary::-webkit-details-marker,
.rv-details > summary::-webkit-details-marker { display: none; }
.rv-toc > details > summary::marker,
.rv-details > summary::marker { content: ""; }
.rv-chev { transition: transform 0.15s ease; }
details[open] > summary .rv-chev { transform: rotate(90deg); }
/* ToC outline: numbered top-level entries, guide-lined nested lists. */
.rv-toc-body ul { list-style: none; margin: 0; padding: 0; }
.rv-toc-body li > p { margin: 0; }
.rv-toc-body a {
  display: flex; align-items: baseline; gap: 0.55rem;
  border-radius: 0.375rem; padding: 0.28rem 0.5rem;
  font-size: 0.875rem; line-height: 1.45;
  color: rgb(82 82 82); text-decoration: none;
  transition: color 0.12s, background 0.12s;
}
.rv-toc-body a:hover { color: rgb(23 23 23); background: rgb(245 245 245); }
.dark .rv-toc-body a { color: rgb(163 163 163); }
.dark .rv-toc-body a:hover { color: rgb(250 250 250); background: rgb(38 38 38); }
.rv-toc-body > ul { counter-reset: rv-toc; }
.rv-toc-body > ul > li { counter-increment: rv-toc; }
.rv-toc-body > ul > li > p > a,
.rv-toc-body > ul > li > a { font-weight: 500; color: rgb(64 64 64); }
.dark .rv-toc-body > ul > li > p > a,
.dark .rv-toc-body > ul > li > a { color: rgb(212 212 212); }
.rv-toc-body > ul > li > p > a::before,
.rv-toc-body > ul > li > a::before {
  content: counter(rv-toc); min-width: 1em;
  font-size: 0.72rem; font-weight: 400; font-variant-numeric: tabular-nums;
  color: rgb(163 163 163);
}
.dark .rv-toc-body > ul > li > p > a::before,
.dark .rv-toc-body > ul > li > a::before { color: rgb(115 115 115); }
.rv-toc-body ul ul {
  margin: 0.15rem 0 0.3rem 0.95rem; padding-left: 0.6rem;
  border-left: 1px solid rgb(229 229 229);
}
.dark .rv-toc-body ul ul { border-color: rgb(64 64 64); }
.rv-toc-body ul ul a { font-size: 0.8125rem; padding: 0.2rem 0.45rem; }
/* Ask: native form controls stay interactive without hydration. The real
 * inputs are visually hidden; state is styled through :checked/~ siblings. */
.rv-choice:has(:checked) {
  border-color: rgb(23 23 23); background: rgb(250 250 250);
}
.dark .rv-choice:has(:checked) {
  border-color: rgb(163 163 163); background: rgb(38 38 38 / 0.35);
}
.rv-choice:has(:focus-visible),
.rv-q:has(:focus-visible) input ~ .rv-switch {
  outline: 2px solid rgb(14 165 233); outline-offset: 1px;
}
.rv-mark {
  display: grid; place-items: center; flex-shrink: 0;
  height: 1rem; width: 1rem; margin-top: 0.15rem;
  border: 1px solid rgb(212 212 212); background: rgb(255 255 255);
  color: transparent; transition: all 0.12s;
}
.rv-mark-box { border-radius: 0.25rem; }
.rv-mark-radio { border-radius: 9999px; }
.rv-mark-radio::after {
  content: ""; width: 0.45rem; height: 0.45rem; border-radius: 9999px;
  background: rgb(23 23 23); transform: scale(0);
  transition: transform 0.12s;
}
.rv-choice input:checked ~ .rv-mark { border-color: rgb(23 23 23); }
.rv-choice input:checked ~ .rv-mark-box {
  background: rgb(23 23 23); color: rgb(255 255 255);
}
.rv-choice input:checked ~ .rv-mark-radio::after { transform: scale(1); }
.dark .rv-mark { border-color: rgb(82 82 82); background: rgb(23 23 23); }
.dark .rv-mark-radio::after { background: rgb(250 250 250); }
.dark .rv-choice input:checked ~ .rv-mark { border-color: rgb(250 250 250); }
.dark .rv-choice input:checked ~ .rv-mark-box {
  background: rgb(250 250 250); color: rgb(23 23 23);
}
/* Toggle questions: a native checkbox styled as a switch. */
.rv-switch {
  position: relative; flex-shrink: 0;
  height: 1.25rem; width: 2.25rem; border-radius: 9999px;
  background: rgb(212 212 212); transition: background 0.15s;
}
.rv-switch::after {
  content: ""; position: absolute; top: 0.125rem; left: 0.125rem;
  height: 1rem; width: 1rem; border-radius: 9999px;
  background: rgb(255 255 255); box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
  transition: transform 0.15s;
}
.rv-q input:checked ~ .rv-switch { background: rgb(23 23 23); }
.rv-q input:checked ~ .rv-switch::after { transform: translateX(1rem); }
.dark .rv-switch { background: rgb(64 64 64); }
.dark .rv-q input:checked ~ .rv-switch { background: rgb(245 245 245); }
.dark .rv-q input:checked ~ .rv-switch::after { background: rgb(23 23 23); }
/* "Copy answers" button feedback: swap the label on success. */
.rv-ask [data-ask-copy].copied .rv-copy-idle { display: none; }
.rv-ask [data-ask-copy].copied .rv-copy-done { display: inline-flex; }
`;

/**
 * Delegated click handler for the document's interactive bits:
 * `[data-copy]` copies a fixed string; `[data-ask-copy]` collects the
 * enclosing `[data-ask]` block's native form controls into a `- name: value`
 * answer sheet. Inlined into documents via `CLIENT_JS` (`toString`) and
 * registered by the Storybook preview, so it must stay self-contained — no
 * imports, no outer-scope references. Helpers stay nested for `toString`
 * inlining even though they capture nothing.
 */
/* oxlint-disable unicorn/consistent-function-scoping -- toString() requires self-containment */
export const handleDocClick = (e: MouseEvent): void => {
  const el = e.target;
  if (!(el instanceof Element)) {
    return;
  }
  const markCopied = (b: HTMLElement): void => {
    b.classList.add("copied");
    setTimeout(() => {
      b.classList.remove("copied");
    }, 1200);
  };
  const writeClipboard = (text: string, done: () => void): void => {
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
        done();
      }
      return;
    }
    void (async () => {
      try {
        await clip.writeText(text);
        done();
      } catch {
        if (legacy()) {
          done();
        }
      }
    })();
  };
  const copyBtn = el.closest("[data-copy]");
  if (copyBtn instanceof HTMLElement) {
    writeClipboard(copyBtn.dataset.copy ?? "", () => {
      markCopied(copyBtn);
    });
    return;
  }
  const askBtn = el.closest("[data-ask-copy]");
  if (askBtn instanceof HTMLElement) {
    const box = askBtn.closest("[data-ask]");
    if (!(box instanceof HTMLElement)) {
      return;
    }
    const answers = new Map<string, string[]>();
    for (const f of box.querySelectorAll("input, select, textarea")) {
      const isInput = f instanceof HTMLInputElement;
      if (
        !(
          isInput ||
          f instanceof HTMLSelectElement ||
          f instanceof HTMLTextAreaElement
        ) ||
        f.name === ""
      ) {
        continue;
      }
      if (
        isInput &&
        (f.type === "checkbox" || f.type === "radio") &&
        !f.checked
      ) {
        continue;
      }
      const v = f.value.trim();
      if (v === "") {
        continue;
      }
      const list = answers.get(f.name);
      if (list === undefined) {
        answers.set(f.name, [v]);
      } else {
        list.push(v);
      }
    }
    const lines = [...answers.entries()].map(
      (kv) => `- ${kv[0]}: ${kv[1].join(", ")}`
    );
    const title = box.dataset.askTitle;
    const head = title === undefined || title === "" ? "" : `${title}\n\n`;
    const text =
      head + (lines.length === 0 ? "(no answers)" : lines.join("\n"));
    writeClipboard(text, () => {
      markCopied(askBtn);
    });
  }
};
/* oxlint-enable unicorn/consistent-function-scoping */

/** Small vanilla JS inlined into every document: copy/answer buttons + mermaid. */
export const CLIENT_JS = `document.addEventListener('click', ${handleDocClick.toString()});`;

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

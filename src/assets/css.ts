/** Base CSS appended after Tailwind utilities (covers what utilities can't). */
export const BASE_CSS = `
/* Preflight makes <svg> display:block, which splits inline text around
 * icons; Iconify svgs (.iconify) and lucide-react svgs (.lucide) stay inline. */
.iconify, .lucide { display: inline-block; }
.task-list-item { list-style: none; }
ul.contains-task-list { padding-left: 1.25rem; }
.task-list-item input[type='checkbox'] { margin-right: 0.4em; }
/* Graph fitting is native SVG sizing: readable minimum scale on screen,
 * full-width containment in print, and a keyboard-operable actual-size toggle. */
.doc-graph-view:has(.doc-graph-actual:checked) .doc-graph-image {
  max-width: none !important;
}
.doc-graph-tools:focus-within { outline: 2px solid rgb(14 165 233); outline-offset: -2px; }
/* Navigation is a progressive enhancement: no-JS documents keep native sizing
 * and scrolling. Transform only the outer SVG, never its icons/edge layers. */
.doc-diagram-tools { display: none; }
.doc-diagrams-ready .doc-graph-tools { display: none; }
.doc-diagrams-ready .doc-diagram:has(.doc-diagram-canvas svg) > .doc-diagram-tools {
  display: flex; align-items: center; justify-content: flex-end; gap: 0.25rem;
  flex-wrap: wrap; padding: 0.375rem 0.75rem; color: rgb(82 82 82);
  border-bottom: 1px solid rgb(229 229 229); font-size: 0.75rem;
}
.doc-diagram-hint { flex: 1 1 12rem; }
.doc-diagram-actions {
  display: flex; align-items: center; gap: 0.25rem; flex-shrink: 0;
  min-width: 0; margin: 0; padding: 0; border: 0;
}
.doc-diagram-tools button {
  display: inline-flex; align-items: center; justify-content: center;
  width: 2rem; height: 2rem; padding: 0; border-radius: 0.375rem;
  background: transparent; color: inherit; cursor: pointer;
}
.doc-diagram-tools button:hover { background: rgb(229 229 229); }
.doc-diagram-tools button:disabled { opacity: 0.35; cursor: default; }
.doc-diagram-tools button:focus-visible, .doc-diagram-canvas:focus-visible {
  outline: 2px solid rgb(14 165 233); outline-offset: -2px;
}
.doc-diagram-tools svg { width: 1rem; height: 1rem; }
.doc-diagram-tools output { min-width: 3rem; text-align: center; font-variant-numeric: tabular-nums; }
.dark .doc-diagram-tools { color: rgb(163 163 163) !important; border-color: rgb(64 64 64) !important; }
.dark .doc-diagram-tools button:hover { background: rgb(64 64 64); }
.doc-diagrams-ready .doc-diagram-canvas:has(svg) {
  display: flex; align-items: safe center; justify-content: safe center;
  overflow: hidden; min-height: 12rem; max-height: 70vh;
  cursor: grab; touch-action: none;
}
.doc-diagram-canvas > svg, .doc-diagram-canvas > .mermaid { flex: none; }
.doc-diagram-canvas > .mermaid { width: 100%; }
.doc-diagrams-ready .doc-diagram-canvas[data-dragging] { cursor: grabbing; user-select: none; }
.doc-diagram-canvas > svg, .doc-diagram-canvas > .mermaid > svg {
  transform: var(--doc-diagram-transform, none); transform-origin: 0 0;
}
.doc-diagram-canvas > .mermaid:has(svg) { overflow: visible; padding: 0; background: transparent; }
@media print {
  .doc-graph-tools, .doc-diagram-tools { display: none !important; }
  .doc-diagram-canvas {
    overflow: visible !important; min-height: 0 !important; max-height: none !important;
  }
  .doc-diagram-canvas > svg, .doc-diagram-canvas > .mermaid > svg {
    transform: none !important; min-width: 0 !important; max-width: 100% !important;
  }
  .doc-graph-scroll { overflow: visible; }
  .doc-graph-view:has(.doc-graph-actual:checked) .doc-graph-image,
  .doc-graph-view .doc-graph-image {
    max-width: 100% !important; min-width: 0 !important; height: auto !important;
  }
}
/* --- Interaction feedback -------------------------------------------
 * Every [data-copy] button carries an idle and a done icon
 * (.doc-copy-idle/.doc-copy-done); the delegated event handler
 * (src/client, also bound in the Storybook preview) toggles
 * .copied/.copy-failed for ~1.6s after each clipboard attempt. Success
 * crossfades the copy icon to an emerald check; failure shakes and tints
 * red; pressing the button scales it down briefly. */
.doc-copy {
  display: inline-grid; place-items: center;
  border-radius: 0.25rem;
  transition: opacity 0.15s ease, color 0.15s ease, transform 0.1s ease;
}
.doc-copy > .doc-copy-idle, .doc-copy > .doc-copy-done {
  display: inline-flex; grid-area: 1 / 1;
  opacity: 0; visibility: hidden; pointer-events: none;
  transform: scale(0.82) rotate(-12deg);
  transition: opacity 0.18s ease,
    transform 0.22s cubic-bezier(0.2, 0.7, 0.3, 1),
    visibility 0s linear 0.18s;
}
.doc-copy:not(.copied) > .doc-copy-idle,
.doc-copy.copied > .doc-copy-done {
  opacity: 1; visibility: visible; pointer-events: auto;
  transform: scale(1) rotate(0);
  transition-delay: 0s;
}
.doc-copy:hover { opacity: 1; }
.doc-copy:active { transform: scale(0.82); }
.doc-copy:focus-visible {
  outline: 2px solid rgb(14 165 233); outline-offset: 1px; opacity: 1;
}
.doc-copy.copied, .doc-copy.copy-failed { opacity: 1; }
.doc-copy.copy-failed { color: rgb(220 38 38); }
.dark .doc-copy.copy-failed { color: rgb(248 113 113); }
/* Theme toggle: fixed corner chrome injected by htmlDocument. Cycles
 * auto → light → dark; [data-mode] picks which icon shows. */
.doc-theme {
  position: fixed; top: 0.75rem; right: 0.75rem; z-index: 50;
  display: inline-grid; place-items: center;
  height: 2rem; width: 2rem; margin: 0; padding: 0; border-radius: 9999px;
  border: 1px solid rgb(229 229 229); color: rgb(82 82 82);
  background: rgb(255 255 255 / 0.85); backdrop-filter: blur(8px);
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease,
    border-color 0.15s ease, transform 0.1s ease;
}
.doc-theme:hover { color: rgb(23 23 23); background: rgb(255 255 255); }
.doc-theme:active { transform: scale(0.88); }
.doc-theme:focus-visible {
  outline: 2px solid rgb(14 165 233); outline-offset: 2px;
}
.dark .doc-theme {
  border-color: rgb(64 64 64); color: rgb(163 163 163);
  background: rgb(23 23 23 / 0.85);
}
.dark .doc-theme:hover { color: rgb(250 250 250); background: rgb(23 23 23); }
.doc-theme .doc-theme-i {
  display: inline-flex; grid-area: 1 / 1;
  opacity: 0; visibility: hidden; pointer-events: none;
  transform: scale(0.82) rotate(-12deg);
  transition: opacity 0.18s ease,
    transform 0.22s cubic-bezier(0.2, 0.7, 0.3, 1),
    visibility 0s linear 0.18s;
}
.doc-theme[data-mode="auto"] .doc-theme-i-auto,
.doc-theme[data-mode="light"] .doc-theme-i-light,
.doc-theme[data-mode="dark"] .doc-theme-i-dark {
  opacity: 1; visibility: visible; pointer-events: auto;
  transform: scale(1) rotate(0);
  transition-delay: 0s;
}
.doc-theme svg { height: 1rem; width: 1rem; }
@media print {
  .doc-theme { display: none; }
  .doc-copy > .doc-copy-idle,
  .doc-copy > .doc-copy-done { transition: none; transform: none; }
}
.doc-copy-done { display: none; }
.copied:not(.doc-copy) .doc-copy-idle { display: none; }
.copied:not(.doc-copy) .doc-copy-done {
  display: inline-flex;
  animation: doc-pop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.copy-failed { animation: doc-shake 0.32s ease; }
[data-ask-copy].copy-failed, [data-ask-save].copy-failed {
  border-color: rgb(248 113 113); color: rgb(220 38 38);
}
.dark [data-ask-copy].copy-failed, .dark [data-ask-save].copy-failed {
  color: rgb(248 113 113);
}
.doc-ask [data-ask-copy].copied, .doc-ask [data-ask-save].copied {
  border-color: rgb(52 211 153 / 0.6);
}
/* Board: cards drag between lanes (and reorder within one). .doc-drag
 * marks the card being held; .doc-drop-before (on a card) and
 * .doc-drop-end (on the lane's card box) draw the insertion line;
 * .doc-drop-lane outlines the target lane. The ‹ › move buttons stay
 * visible at low opacity — they're the touch/keyboard path (HTML5 DnD
 * never reaches touch browsers). */
[data-board-card] { cursor: grab; }
[data-board-card].doc-drag { cursor: grabbing; opacity: 0.4; }
[data-board-card].doc-drop-before { box-shadow: 0 -2px 0 0 rgb(14 165 233); }
[data-board-cards].doc-drop-end {
  box-shadow: inset 0 -2px 0 0 rgb(14 165 233);
  border-radius: 0.375rem;
}
[data-board-lane].doc-drop-lane {
  outline: 2px dashed rgb(14 165 233 / 0.5);
  outline-offset: -2px;
}
.doc-move {
  display: inline-flex; align-items: center; justify-content: center;
  height: 1.25rem; width: 1.25rem; border: 0; padding: 0;
  border-radius: 0.25rem; background: transparent;
  color: rgb(163 163 163); cursor: pointer; opacity: 0.6;
  transition: opacity 0.15s ease, color 0.15s ease,
    background-color 0.15s ease, transform 0.1s ease;
}
.doc-move:not(:disabled):hover {
  opacity: 1; color: rgb(64 64 64); background: rgb(245 245 245);
}
.dark .doc-move:not(:disabled):hover {
  color: rgb(212 212 212); background: rgb(38 38 38);
}
.doc-move:not(:disabled):active { transform: scale(0.85); }
.doc-move:focus-visible {
  outline: 2px solid rgb(14 165 233); outline-offset: 1px; opacity: 1;
}
.doc-move:disabled { opacity: 0.2; cursor: default; }
@media print {
  .doc-card-moves, .doc-board-tools, .doc-grip { display: none; }
}
/* <Comments>: a hover "+" on every code/diff row opens the comment form
 * under that line. The button sits in the code block's left bleed band
 * (.doc-cline — its .line child keeps the -1rem band bleed) or over the
 * diff row's line-number gutter (.doc-drow); invisible until the row is
 * hovered or the button takes keyboard focus. */
.doc-cline, .doc-drow { position: relative; }
.doc-add {
  position: absolute; top: 0; bottom: 0; z-index: 1;
  display: flex; align-items: center; justify-content: center;
  width: 1rem; border: 0; padding: 0; background: transparent;
  color: rgb(163 163 163); cursor: pointer; opacity: 0;
  transition: opacity 0.12s ease, color 0.12s ease;
}
.doc-cline > .doc-add { left: -1rem; }
.doc-drow > .doc-add { left: 0.1rem; }
.doc-cline:hover > .doc-add, .doc-drow:hover > .doc-add,
.doc-add:focus-visible { opacity: 1; }
.doc-add:hover { color: rgb(2 132 199); }
.dark .doc-add { color: rgb(115 115 115); }
.dark .doc-add:hover { color: rgb(56 189 248); }
@media print {
  .doc-add, .doc-thread-tools, [data-comment-form] { display: none; }
}
@keyframes doc-pop {
  0% { transform: scale(0.3); opacity: 0; }
  70% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes doc-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}
/* shiki dual-theme: token spans carry --shiki-* variables, not colors.
 * Scoping to .line descendants keeps spans that share a .shiki ancestor for
 * layout (e.g. <Comments> thread strips) from losing their own colors to an
 * undefined --shiki-* var. .doc-diff-hl marks the same kind of token span
 * inside DiffView rows — it is not nested in a .shiki code element, so it
 * joins the selectors here. */
.shiki .line span, .doc-diff-hl {
  color: var(--shiki-light);
  font-style: var(--shiki-light-font-style, normal);
  font-weight: var(--shiki-light-font-weight, normal);
  text-decoration: var(--shiki-light-text-decoration, none);
}
@media (prefers-color-scheme: dark) {
  .shiki .line span, .doc-diff-hl {
    color: var(--shiki-dark);
    font-style: var(--shiki-dark-font-style, normal);
    font-weight: var(--shiki-dark-font-weight, normal);
    text-decoration: var(--shiki-dark-text-decoration, none);
  }
}
/* The .dark class (set by THEME_JS in documents, the toolbar in Storybook)
 * wins over the media query so toggling it re-themes code blocks too. */
.dark .shiki .line span, .dark .doc-diff-hl {
  color: var(--shiki-dark);
  font-style: var(--shiki-dark-font-style, normal);
  font-weight: var(--shiki-dark-font-weight, normal);
  text-decoration: var(--shiki-dark-text-decoration, none);
}
html:not(.dark) .shiki .line span, html:not(.dark) .doc-diff-hl {
  color: var(--shiki-light);
  font-style: var(--shiki-light-font-style, normal);
  font-weight: var(--shiki-light-font-weight, normal);
  text-decoration: var(--shiki-light-text-decoration, none);
}
/* Line-level features: fences carry has-* classes on <code> itself. The code
 * is a column flex box so .line spans become block-level items (bands/numbers
 * span the block width) while the raw "\n" text nodes shiki leaves between
 * them collapse — whitespace-only anonymous flex items never render, so they
 * can't double the line spacing under the pre's white-space: pre. The pre's
 * p-4 (1rem) is mirrored here so highlight bands bleed to the block edge;
 * min-height keeps empty .line spans from collapsing to zero. */
.shiki { display: flex; flex-direction: column; }
.shiki .line { display: block; min-height: 1lh; margin: 0 -1rem; padding: 0 1rem; }
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
.shiki.has-focused .line:not(.focused) { opacity: 0.4; }
.shiki .line.focused { opacity: 1; }
.shiki span.highlighted-word {
  background: rgba(245, 158, 11, 0.18); border-radius: 0.25rem;
  outline: 1px solid rgba(245, 158, 11, 0.35); padding: 0 0.1rem;
}
.shiki.has-line-numbers { counter-reset: doc-line; }
.shiki.has-line-numbers .line::before {
  counter-increment: doc-line; content: counter(doc-line);
  display: inline-block; width: 1.8em; margin-right: 1em;
  text-align: right; color: rgba(113, 113, 122, 0.6); user-select: none;
}
.shiki.has-line-numbers .line.diff.add::before,
.shiki.has-line-numbers .line.diff.remove::before {
  content: counter(doc-line); /* numbers win over the +/− gutter marker */
}
/* KaTeX display math gets a little breathing room. */
.katex-display { margin: 1.25rem 0; }
/* Smooth anchor jumps for the ToC and other in-page links. */
html { scroll-behavior: smooth; }
/* Native <details> used by Toc/Details/Tree/Json: drop the default marker,
 * rotate the chevron on open. */
.doc-toc > details > summary::-webkit-details-marker,
.doc-details > summary::-webkit-details-marker,
.doc-tree summary::-webkit-details-marker,
.doc-json summary::-webkit-details-marker { display: none; }
.doc-toc > details > summary::marker,
.doc-details > summary::marker,
.doc-tree summary::marker,
.doc-json summary::marker { content: ""; }
/* Json: the "N keys/items" badge only matters while the node is folded. */
.doc-json details[open] > summary .doc-count { display: none; }
.doc-chev { transition: transform 0.15s ease; }
details[open] > summary .doc-chev { transform: rotate(90deg); }
/* Smooth expand/collapse for the native <details> blocks (Details, Toc,
 * Tree folders). Chromium animates block-size via ::details-content +
 * interpolate-size; engines without the pseudo-element never match these
 * rules and keep the instant toggle. */
:root { interpolate-size: allow-keywords; }
.doc-details::details-content,
.doc-toc > details::details-content,
.doc-tree details::details-content {
  block-size: 0;
  overflow-y: clip;
  transition:
    content-visibility 0.22s allow-discrete,
    block-size 0.22s ease;
}
.doc-details[open]::details-content,
.doc-toc > details[open]::details-content,
.doc-tree details[open]::details-content {
  block-size: auto;
  block-size: calc-size(auto);
}
/* ToC outline: numbered top-level entries, guide-lined nested lists. */
.doc-toc-body ul { list-style: none; margin: 0; padding: 0; }
.doc-toc-body li > p { margin: 0; }
.doc-toc-body a {
  display: flex; align-items: baseline; gap: 0.55rem;
  border-radius: 0.375rem; padding: 0.28rem 0.5rem;
  font-size: 0.875rem; line-height: 1.45;
  color: rgb(82 82 82); text-decoration: none;
  transition: color 0.12s, background 0.12s;
}
.doc-toc-body a:hover { color: rgb(23 23 23); background: rgb(245 245 245); }
.doc-toc-body a:active { background: rgb(229 229 229); }
.dark .doc-toc-body a:active { background: rgb(64 64 64); }
.dark .doc-toc-body a { color: rgb(163 163 163); }
.dark .doc-toc-body a:hover { color: rgb(250 250 250); background: rgb(38 38 38); }
.doc-toc-body > ul { counter-reset: doc-toc; }
.doc-toc-body > ul > li { counter-increment: doc-toc; }
.doc-toc-body > ul > li > p > a,
.doc-toc-body > ul > li > a { font-weight: 500; color: rgb(64 64 64); }
.dark .doc-toc-body > ul > li > p > a,
.dark .doc-toc-body > ul > li > a { color: rgb(212 212 212); }
.doc-toc-body > ul > li > p > a::before,
.doc-toc-body > ul > li > a::before {
  content: counter(doc-toc); min-width: 1em; flex-shrink: 0; white-space: nowrap;
  font-size: 0.72rem; font-weight: 400; font-variant-numeric: tabular-nums;
  color: rgb(163 163 163);
}
.dark .doc-toc-body > ul > li > p > a::before,
.dark .doc-toc-body > ul > li > a::before { color: rgb(115 115 115); }
.doc-toc-body ul ul {
  margin: 0.15rem 0 0.3rem 0.95rem; padding-left: 0.6rem;
  border-left: 1px solid rgb(229 229 229);
}
.dark .doc-toc-body ul ul { border-color: rgb(64 64 64); }
.doc-toc-body ul ul a { font-size: 0.8125rem; padding: 0.2rem 0.45rem; }
/* A 64rem viewport fits the usual 45rem article, a 14rem ToC, a 2rem
 * gap, and 1.5rem outer gutters. Only the first document-level ToC docks;
 * additional or nested tables stay in the document flow. Print stays inline. */
@media screen and (min-width: 64rem) {
  #doc-root:has(> .doc-toc, > article:only-of-type > .doc-toc) {
    max-width: 64rem;
    padding-right: 17.5rem;
  }
  #doc-root > .doc-toc:nth-child(1 of .doc-toc),
  #doc-root:not(:has(> .doc-toc)) > article:only-of-type > .doc-toc:nth-child(1 of .doc-toc) {
    position: fixed;
    top: 4rem;
    right: max(1.5rem, calc((100vw - 64rem) / 2 + 1.5rem));
    width: 14rem;
    max-height: calc(100dvh - 5.5rem);
    margin: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    overflow-wrap: anywhere;
  }
}
/* Ask: native form controls stay interactive without hydration. The real
 * inputs are visually hidden; state is styled through :checked/~ siblings. */
.doc-choice {
  transition: color 0.12s, background-color 0.12s, border-color 0.12s,
    transform 0.1s ease;
}
.doc-choice:active { transform: scale(0.985); }
.doc-choice:has(:checked) {
  border-color: rgb(23 23 23); background: rgb(250 250 250);
}
.dark .doc-choice:has(:checked) {
  border-color: rgb(163 163 163); background: rgb(38 38 38 / 0.35);
}
.doc-choice:has(:focus-visible),
.doc-q:has(:focus-visible) input ~ .doc-switch {
  outline: 2px solid rgb(14 165 233); outline-offset: 1px;
}
.doc-mark {
  display: grid; place-items: center; flex-shrink: 0;
  height: 1rem; width: 1rem; margin-top: 0.15rem;
  border: 1px solid rgb(212 212 212); background: rgb(255 255 255);
  color: transparent; transition: all 0.12s;
}
.doc-mark-box { border-radius: 0.25rem; }
.doc-mark-radio { border-radius: 9999px; }
.doc-mark-radio::after {
  content: ""; width: 0.45rem; height: 0.45rem; border-radius: 9999px;
  background: rgb(23 23 23); transform: scale(0);
  transition: transform 0.12s;
}
.doc-choice input:checked ~ .doc-mark { border-color: rgb(23 23 23); }
.doc-choice input:checked ~ .doc-mark-box {
  background: rgb(23 23 23); color: rgb(255 255 255);
}
/* Checkbox glyph pops in instead of fading. */
.doc-mark-box svg {
  transform: scale(0.4);
  transition: transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.doc-choice input:checked ~ .doc-mark-box svg { transform: scale(1); }
.doc-choice input:checked ~ .doc-mark-radio::after { transform: scale(1); }
.dark .doc-mark { border-color: rgb(82 82 82); background: rgb(23 23 23); }
.dark .doc-mark-radio::after { background: rgb(250 250 250); }
.dark .doc-choice input:checked ~ .doc-mark { border-color: rgb(250 250 250); }
.dark .doc-choice input:checked ~ .doc-mark-box {
  background: rgb(250 250 250); color: rgb(23 23 23);
}
/* Toggle questions: a native checkbox styled as a switch. */
.doc-switch {
  position: relative; flex-shrink: 0;
  height: 1.25rem; width: 2.25rem; border-radius: 9999px;
  background: rgb(212 212 212); transition: background 0.15s;
}
.doc-switch::after {
  content: ""; position: absolute; top: 0.125rem; left: 0.125rem;
  height: 1rem; width: 1rem; border-radius: 9999px;
  background: rgb(255 255 255); box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
  transition: transform 0.15s, width 0.15s;
}
.doc-q input:checked ~ .doc-switch { background: rgb(23 23 23); }
.doc-q input:checked ~ .doc-switch::after { transform: translateX(1rem); }
/* Thumb stretches while the switch is held (iOS-style press feedback). */
.doc-q:active .doc-switch::after { width: 1.25rem; }
.doc-q:active input:checked ~ .doc-switch::after {
  transform: translateX(0.875rem);
}
.dark .doc-switch { background: rgb(64 64 64); }
.dark .doc-q input:checked ~ .doc-switch { background: rgb(245 245 245); }
.dark .doc-q input:checked ~ .doc-switch::after { background: rgb(23 23 23); }
/* Reduced motion: every animation/transition above becomes instant. */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .doc-add,
  .doc-copy,
  .doc-copy > .doc-copy-idle,
  .doc-copy > .doc-copy-done,
  .doc-theme .doc-theme-i,
  .doc-chev,
  .doc-choice,
  .doc-mark,
  .doc-mark-box svg,
  .doc-move,
  .doc-switch,
  .doc-switch::after,
  .doc-theme,
  .doc-toc-body a {
    transition: none;
  }
  .doc-copy:active { transform: none; }
  .doc-choice:active { transform: none; }
  .doc-move:active { transform: none; }
  .doc-theme:active { transform: none; }
  .copied:not(.doc-copy) .doc-copy-done, .copy-failed { animation: none; }
  .doc-details::details-content,
  .doc-toc > details::details-content,
  .doc-tree details::details-content { transition: none; }
}
`;

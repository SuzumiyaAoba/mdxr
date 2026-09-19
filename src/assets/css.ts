/** Base CSS appended after Tailwind utilities (covers what utilities can't). */
export const BASE_CSS = `
/* Preflight makes <svg> display:block, which splits inline text around
 * icons; Iconify svgs (.iconify) and lucide-react svgs (.lucide) stay inline. */
.iconify, .lucide { display: inline-block; }
.task-list-item { list-style: none; }
ul.contains-task-list { padding-left: 1.25rem; }
.task-list-item input[type='checkbox'] { margin-right: 0.4em; }
/* --- Interaction feedback -------------------------------------------
 * Every [data-copy] button carries an idle and a done icon
 * (.mdxr-copy-idle/.mdxr-copy-done); the delegated event handler
 * (src/client, also bound in the Storybook preview) toggles
 * .copied/.copy-failed for ~1.6s after each clipboard attempt. Success
 * swaps the copy icon for an emerald check with a pop; failure shakes and
 * tints red; pressing the button scales it down briefly. */
.mdxr-copy {
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 0.25rem;
  transition: opacity 0.15s ease, color 0.15s ease, transform 0.1s ease;
}
.mdxr-copy:hover { opacity: 1; }
.mdxr-copy:active { transform: scale(0.82); }
.mdxr-copy:focus-visible {
  outline: 2px solid rgb(14 165 233); outline-offset: 1px; opacity: 1;
}
.mdxr-copy.copied, .mdxr-copy.copy-failed { opacity: 1; }
.mdxr-copy.copy-failed { color: rgb(220 38 38); }
.dark .mdxr-copy.copy-failed { color: rgb(248 113 113); }
/* Theme toggle: fixed corner chrome injected by htmlDocument. Cycles
 * auto → light → dark; [data-mode] picks which icon shows. */
.mdxr-theme {
  position: fixed; top: 0.75rem; right: 0.75rem; z-index: 50;
  display: inline-flex; align-items: center; justify-content: center;
  height: 2rem; width: 2rem; margin: 0; padding: 0; border-radius: 9999px;
  border: 1px solid rgb(229 229 229); color: rgb(82 82 82);
  background: rgb(255 255 255 / 0.85); backdrop-filter: blur(8px);
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease,
    border-color 0.15s ease, transform 0.1s ease;
}
.mdxr-theme:hover { color: rgb(23 23 23); background: rgb(255 255 255); }
.mdxr-theme:active { transform: scale(0.88); }
.mdxr-theme:focus-visible {
  outline: 2px solid rgb(14 165 233); outline-offset: 2px;
}
.dark .mdxr-theme {
  border-color: rgb(64 64 64); color: rgb(163 163 163);
  background: rgb(23 23 23 / 0.85);
}
.dark .mdxr-theme:hover { color: rgb(250 250 250); background: rgb(23 23 23); }
.mdxr-theme .mdxr-theme-i { display: none; }
.mdxr-theme[data-mode="auto"] .mdxr-theme-i-auto,
.mdxr-theme[data-mode="light"] .mdxr-theme-i-light,
.mdxr-theme[data-mode="dark"] .mdxr-theme-i-dark {
  display: inline-flex;
  animation: mdxr-pop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.mdxr-theme svg { height: 1rem; width: 1rem; }
@media print { .mdxr-theme { display: none; } }
.mdxr-copy-done { display: none; }
.copied .mdxr-copy-idle { display: none; }
.copied .mdxr-copy-done {
  display: inline-flex;
  animation: mdxr-pop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.copy-failed { animation: mdxr-shake 0.32s ease; }
[data-ask-copy].copy-failed, [data-ask-save].copy-failed {
  border-color: rgb(248 113 113); color: rgb(220 38 38);
}
.dark [data-ask-copy].copy-failed, .dark [data-ask-save].copy-failed {
  color: rgb(248 113 113);
}
.mdxr-ask [data-ask-copy].copied, .mdxr-ask [data-ask-save].copied {
  border-color: rgb(52 211 153 / 0.6);
}
/* Board: cards drag between lanes (and reorder within one). .mdxr-drag
 * marks the card being held; .mdxr-drop-before (on a card) and
 * .mdxr-drop-end (on the lane's card box) draw the insertion line;
 * .mdxr-drop-lane outlines the target lane. The ‹ › move buttons stay
 * visible at low opacity — they're the touch/keyboard path (HTML5 DnD
 * never reaches touch browsers). */
[data-board-card] { cursor: grab; }
[data-board-card].mdxr-drag { cursor: grabbing; opacity: 0.4; }
[data-board-card].mdxr-drop-before { box-shadow: 0 -2px 0 0 rgb(14 165 233); }
[data-board-cards].mdxr-drop-end {
  box-shadow: inset 0 -2px 0 0 rgb(14 165 233);
  border-radius: 0.375rem;
}
[data-board-lane].mdxr-drop-lane {
  outline: 2px dashed rgb(14 165 233 / 0.5);
  outline-offset: -2px;
}
.mdxr-move {
  display: inline-flex; align-items: center; justify-content: center;
  height: 1.25rem; width: 1.25rem; border: 0; padding: 0;
  border-radius: 0.25rem; background: transparent;
  color: rgb(163 163 163); cursor: pointer; opacity: 0.6;
  transition: opacity 0.15s ease, color 0.15s ease,
    background-color 0.15s ease, transform 0.1s ease;
}
.mdxr-move:not(:disabled):hover {
  opacity: 1; color: rgb(64 64 64); background: rgb(245 245 245);
}
.dark .mdxr-move:not(:disabled):hover {
  color: rgb(212 212 212); background: rgb(38 38 38);
}
.mdxr-move:not(:disabled):active { transform: scale(0.85); }
.mdxr-move:focus-visible {
  outline: 2px solid rgb(14 165 233); outline-offset: 1px; opacity: 1;
}
.mdxr-move:disabled { opacity: 0.2; cursor: default; }
@media print {
  .mdxr-card-moves, .mdxr-board-tools, .mdxr-grip { display: none; }
}
@keyframes mdxr-pop {
  0% { transform: scale(0.3); opacity: 0; }
  70% { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes mdxr-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}
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
  background: rgba(245, 158, 11, 0.18); border-radius: 0.2rem;
  outline: 1px solid rgba(245, 158, 11, 0.35); padding: 0 0.1rem;
}
.shiki.has-line-numbers { counter-reset: mdxr-line; }
.shiki.has-line-numbers .line::before {
  counter-increment: mdxr-line; content: counter(mdxr-line);
  display: inline-block; width: 1.8em; margin-right: 1em;
  text-align: right; color: rgba(113, 113, 122, 0.6); user-select: none;
}
.shiki.has-line-numbers .line.diff.add::before,
.shiki.has-line-numbers .line.diff.remove::before {
  content: counter(mdxr-line); /* numbers win over the +/− gutter marker */
}
/* KaTeX display math gets a little breathing room. */
.katex-display { margin: 1.25rem 0; }
/* Smooth anchor jumps for the ToC and other in-page links. */
html { scroll-behavior: smooth; }
/* Native <details> used by Toc/Details/Tree/Json: drop the default marker,
 * rotate the chevron on open. */
.mdxr-toc > details > summary::-webkit-details-marker,
.mdxr-details > summary::-webkit-details-marker,
.mdxr-tree summary::-webkit-details-marker,
.mdxr-json summary::-webkit-details-marker { display: none; }
.mdxr-toc > details > summary::marker,
.mdxr-details > summary::marker,
.mdxr-tree summary::marker,
.mdxr-json summary::marker { content: ""; }
/* Json: the "N keys/items" badge only matters while the node is folded. */
.mdxr-json details[open] > summary .mdxr-count { display: none; }
.mdxr-chev { transition: transform 0.15s ease; }
details[open] > summary .mdxr-chev { transform: rotate(90deg); }
/* Smooth expand/collapse for the native <details> blocks (Details, Toc,
 * Tree folders). Chromium animates block-size via ::details-content +
 * interpolate-size; engines without the pseudo-element never match these
 * rules and keep the instant toggle. */
:root { interpolate-size: allow-keywords; }
.mdxr-details::details-content,
.mdxr-toc > details::details-content,
.mdxr-tree details::details-content {
  block-size: 0;
  overflow-y: clip;
  transition:
    content-visibility 0.22s allow-discrete,
    block-size 0.22s ease;
}
.mdxr-details[open]::details-content,
.mdxr-toc > details[open]::details-content,
.mdxr-tree details[open]::details-content {
  block-size: auto;
  block-size: calc-size(auto);
}
/* ToC outline: numbered top-level entries, guide-lined nested lists. */
.mdxr-toc-body ul { list-style: none; margin: 0; padding: 0; }
.mdxr-toc-body li > p { margin: 0; }
.mdxr-toc-body a {
  display: flex; align-items: baseline; gap: 0.55rem;
  border-radius: 0.375rem; padding: 0.28rem 0.5rem;
  font-size: 0.875rem; line-height: 1.45;
  color: rgb(82 82 82); text-decoration: none;
  transition: color 0.12s, background 0.12s;
}
.mdxr-toc-body a:hover { color: rgb(23 23 23); background: rgb(245 245 245); }
.mdxr-toc-body a:active { background: rgb(229 229 229); }
.dark .mdxr-toc-body a:active { background: rgb(64 64 64); }
.dark .mdxr-toc-body a { color: rgb(163 163 163); }
.dark .mdxr-toc-body a:hover { color: rgb(250 250 250); background: rgb(38 38 38); }
.mdxr-toc-body > ul { counter-reset: mdxr-toc; }
.mdxr-toc-body > ul > li { counter-increment: mdxr-toc; }
.mdxr-toc-body > ul > li > p > a,
.mdxr-toc-body > ul > li > a { font-weight: 500; color: rgb(64 64 64); }
.dark .mdxr-toc-body > ul > li > p > a,
.dark .mdxr-toc-body > ul > li > a { color: rgb(212 212 212); }
.mdxr-toc-body > ul > li > p > a::before,
.mdxr-toc-body > ul > li > a::before {
  content: counter(mdxr-toc); min-width: 1em;
  font-size: 0.72rem; font-weight: 400; font-variant-numeric: tabular-nums;
  color: rgb(163 163 163);
}
.dark .mdxr-toc-body > ul > li > p > a::before,
.dark .mdxr-toc-body > ul > li > a::before { color: rgb(115 115 115); }
.mdxr-toc-body ul ul {
  margin: 0.15rem 0 0.3rem 0.95rem; padding-left: 0.6rem;
  border-left: 1px solid rgb(229 229 229);
}
.dark .mdxr-toc-body ul ul { border-color: rgb(64 64 64); }
.mdxr-toc-body ul ul a { font-size: 0.8125rem; padding: 0.2rem 0.45rem; }
/* Ask: native form controls stay interactive without hydration. The real
 * inputs are visually hidden; state is styled through :checked/~ siblings. */
.mdxr-choice {
  transition: color 0.12s, background-color 0.12s, border-color 0.12s,
    transform 0.1s ease;
}
.mdxr-choice:active { transform: scale(0.985); }
.mdxr-choice:has(:checked) {
  border-color: rgb(23 23 23); background: rgb(250 250 250);
}
.dark .mdxr-choice:has(:checked) {
  border-color: rgb(163 163 163); background: rgb(38 38 38 / 0.35);
}
.mdxr-choice:has(:focus-visible),
.mdxr-q:has(:focus-visible) input ~ .mdxr-switch {
  outline: 2px solid rgb(14 165 233); outline-offset: 1px;
}
.mdxr-mark {
  display: grid; place-items: center; flex-shrink: 0;
  height: 1rem; width: 1rem; margin-top: 0.15rem;
  border: 1px solid rgb(212 212 212); background: rgb(255 255 255);
  color: transparent; transition: all 0.12s;
}
.mdxr-mark-box { border-radius: 0.25rem; }
.mdxr-mark-radio { border-radius: 9999px; }
.mdxr-mark-radio::after {
  content: ""; width: 0.45rem; height: 0.45rem; border-radius: 9999px;
  background: rgb(23 23 23); transform: scale(0);
  transition: transform 0.12s;
}
.mdxr-choice input:checked ~ .mdxr-mark { border-color: rgb(23 23 23); }
.mdxr-choice input:checked ~ .mdxr-mark-box {
  background: rgb(23 23 23); color: rgb(255 255 255);
}
/* Checkbox glyph pops in instead of fading. */
.mdxr-mark-box svg {
  transform: scale(0.4);
  transition: transform 0.16s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.mdxr-choice input:checked ~ .mdxr-mark-box svg { transform: scale(1); }
.mdxr-choice input:checked ~ .mdxr-mark-radio::after { transform: scale(1); }
.dark .mdxr-mark { border-color: rgb(82 82 82); background: rgb(23 23 23); }
.dark .mdxr-mark-radio::after { background: rgb(250 250 250); }
.dark .mdxr-choice input:checked ~ .mdxr-mark { border-color: rgb(250 250 250); }
.dark .mdxr-choice input:checked ~ .mdxr-mark-box {
  background: rgb(250 250 250); color: rgb(23 23 23);
}
/* Toggle questions: a native checkbox styled as a switch. */
.mdxr-switch {
  position: relative; flex-shrink: 0;
  height: 1.25rem; width: 2.25rem; border-radius: 9999px;
  background: rgb(212 212 212); transition: background 0.15s;
}
.mdxr-switch::after {
  content: ""; position: absolute; top: 0.125rem; left: 0.125rem;
  height: 1rem; width: 1rem; border-radius: 9999px;
  background: rgb(255 255 255); box-shadow: 0 1px 2px rgb(0 0 0 / 0.25);
  transition: transform 0.15s, width 0.15s;
}
.mdxr-q input:checked ~ .mdxr-switch { background: rgb(23 23 23); }
.mdxr-q input:checked ~ .mdxr-switch::after { transform: translateX(1rem); }
/* Thumb stretches while the switch is held (iOS-style press feedback). */
.mdxr-q:active .mdxr-switch::after { width: 1.25rem; }
.mdxr-q:active input:checked ~ .mdxr-switch::after {
  transform: translateX(0.875rem);
}
.dark .mdxr-switch { background: rgb(64 64 64); }
.dark .mdxr-q input:checked ~ .mdxr-switch { background: rgb(245 245 245); }
.dark .mdxr-q input:checked ~ .mdxr-switch::after { background: rgb(23 23 23); }
/* Reduced motion: every animation/transition above becomes instant. */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .mdxr-copy,
  .mdxr-chev,
  .mdxr-choice,
  .mdxr-mark,
  .mdxr-mark-box svg,
  .mdxr-move,
  .mdxr-switch,
  .mdxr-switch::after,
  .mdxr-theme,
  .mdxr-toc-body a {
    transition: none;
  }
  .mdxr-copy:active { transform: none; }
  .mdxr-choice:active { transform: none; }
  .mdxr-move:active { transform: none; }
  .mdxr-theme:active { transform: none; }
  .copied .mdxr-copy-done, .copy-failed { animation: none; }
  .mdxr-theme .mdxr-theme-i { animation: none; }
  .mdxr-details::details-content,
  .mdxr-toc > details::details-content,
  .mdxr-tree details::details-content { transition: none; }
}
`;

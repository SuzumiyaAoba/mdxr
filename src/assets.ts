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
 * (.mdxr-copy-idle/.mdxr-copy-done); the delegated event handler (CLIENT_JS,
 * also bound in the Storybook preview) toggles .copied/.copy-failed for
 * ~1.6s after each clipboard attempt. Success swaps the copy icon for an
 * emerald check with a pop; failure shakes and tints red; pressing the
 * button scales it down briefly. */
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
  .mdxr-switch,
  .mdxr-switch::after,
  .mdxr-theme,
  .mdxr-toc-body a {
    transition: none;
  }
  .mdxr-copy:active { transform: none; }
  .mdxr-choice:active { transform: none; }
  .mdxr-theme:active { transform: none; }
  .copied .mdxr-copy-done, .copy-failed { animation: none; }
  .mdxr-theme .mdxr-theme-i { animation: none; }
  .mdxr-details::details-content,
  .mdxr-toc > details::details-content,
  .mdxr-tree details::details-content { transition: none; }
}
`;

/* The helpers below are inlined into documents via `CLIENT_JS` (`toString`)
 * and shared by the Storybook preview's live `handleDocEvent` binding, so
 * each must stay self-contained — no imports, no outer-scope references.
 * They live at module scope and are emitted one by one (`CLIENT_FNS`), which
 * keeps the emitted script identical in behavior while keeping every unit
 * small enough to stay readable.
 */

// Flashes a feedback state on a button: swaps to the .mdxr-copy-done icon /
// label and tints it via .copied (success) or shakes it red via
// .copy-failed. A repeat click restarts the pop (reflow) and the timer.
const flash = (
  b: HTMLElement,
  cls: "copied" | "copy-failed",
  label?: string
): void => {
  const ex = b as HTMLElement & {
    mdxrLabel?: null | string;
    mdxrTimer?: ReturnType<typeof setTimeout>;
  };
  clearTimeout(ex.mdxrTimer);
  if (label !== undefined) {
    ex.mdxrLabel ??= b.getAttribute("aria-label");
    b.setAttribute("aria-label", label);
  }
  b.classList.remove("copied", "copy-failed");
  void b.offsetWidth;
  b.classList.add(cls);
  ex.mdxrTimer = setTimeout(() => {
    b.classList.remove(cls);
    if (ex.mdxrLabel !== undefined) {
      if (ex.mdxrLabel === null) {
        b.removeAttribute("aria-label");
      } else {
        b.setAttribute("aria-label", ex.mdxrLabel);
      }
      ex.mdxrLabel = undefined;
    }
  }, 1600);
};

const writeClipboard = (
  text: string,
  done: () => void,
  fail: () => void
): void => {
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
    } else {
      fail();
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
      } else {
        fail();
      }
    }
  })();
};

// Writes `text` to the clipboard and flashes `btn` accordingly; labels are
// optional so icon-only buttons can omit them.
const copyWithFeedback = (
  btn: HTMLElement,
  text: string,
  doneLabel?: string,
  failLabel?: string
): void => {
  writeClipboard(
    text,
    () => {
      flash(btn, "copied", doneLabel);
    },
    () => {
      flash(btn, "copy-failed", failLabel);
    }
  );
};

// The text a reader actually selected for a choice/select answer: the
// choice card's visible label minus its description, or the <option> text.
// Falls back to the control's value when no text can be read.
const choiceText = (f: Element): string => {
  if (f instanceof HTMLOptionElement) {
    const t = (f.textContent ?? "").trim();
    return t === "" ? f.value : t;
  }
  const fallback = f instanceof HTMLInputElement ? f.value : "";
  const body = f.closest("label")?.querySelector(".mdxr-choice-text");
  if (!(body instanceof HTMLElement)) {
    return fallback;
  }
  let t = "";
  for (const n of body.childNodes) {
    if (n instanceof HTMLElement && n.classList.contains("mdxr-choice-desc")) {
      continue;
    }
    t += n.textContent ?? "";
  }
  t = t.replaceAll(/\s+/gu, " ").trim();
  return t === "" ? fallback : t;
};

const multiAnswer = (q: HTMLElement): string => {
  const vals: string[] = [];
  for (const f of q.querySelectorAll("input:checked")) {
    const v = choiceText(f);
    if (v !== "") {
      vals.push(v);
    }
  }
  return vals.join(", ");
};

const choiceAnswer = (q: HTMLElement): string => {
  const f = q.querySelector("input:checked");
  return f === null ? "" : choiceText(f);
};

const selectAnswer = (q: HTMLElement): string => {
  const s = q.querySelector("select");
  const [opt] =
    s instanceof HTMLSelectElement && s.value !== "" ? s.selectedOptions : [];
  return opt === undefined ? "" : choiceText(opt);
};

const fieldAnswer = (q: HTMLElement): string => {
  const f = q.querySelector("input, textarea");
  if (f instanceof HTMLTextAreaElement) {
    return f.value.trim();
  }
  if (!(f instanceof HTMLInputElement)) {
    return "";
  }
  if (f.type === "checkbox") {
    // Toggle questions are checkboxes — always answered, yes or no.
    return f.checked ? "yes" : "no";
  }
  return f.value.trim();
};

// One question's answer: checked choices read as their visible text,
// selects as the chosen option's text, toggles as yes/no, free-form
// fields as their raw value. "" means unanswered.
const answerOf = (q: HTMLElement): string => {
  const t = q.dataset.qType;
  if (t === "multi") {
    return multiAnswer(q);
  }
  if (t === "choice") {
    return choiceAnswer(q);
  }
  if (t === "select") {
    return selectAnswer(q);
  }
  return fieldAnswer(q);
};

// Serializes an [data-ask] block into the Markdown answer sheet shown in
// [data-ask-output]: `# title` then one `- **label**: answer` line per
// question, in DOM order. Unanswered fields stay blank; toggles are
// always answered (yes/no). Multi-line answers indent under their item.
const askMarkdown = (box: HTMLElement): string => {
  const lines: string[] = [];
  for (const q of box.querySelectorAll("[data-mdxr-q]")) {
    if (!(q instanceof HTMLElement)) {
      continue;
    }
    const answer = answerOf(q).replaceAll("\n", "\n  ");
    lines.push(
      `- **${q.dataset.qLabel ?? ""}**:${answer === "" ? "" : ` ${answer}`}`
    );
  }
  const title = box.dataset.askTitle ?? "Answers";
  return `# ${title}\n\n${lines.length === 0 ? "(no questions)" : lines.join("\n")}`;
};

// Re-renders the answer sheet into the block's [data-ask-output] pane.
const syncAsk = (box: HTMLElement): void => {
  const out = box.querySelector("[data-ask-output]");
  if (out !== null) {
    out.textContent = askMarkdown(box);
  }
};

// Downloads the answer sheet as `<slug>.md` via a temporary blob link.
const saveAsk = (box: HTMLElement, btn: HTMLElement): void => {
  syncAsk(box);
  const slug = (box.dataset.askTitle ?? "answers")
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");
  const url = URL.createObjectURL(
    new Blob([askMarkdown(box)], { type: "text/markdown;charset=utf-8" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug === "" ? "answers" : slug}.md`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
  flash(btn, "copied");
};

// Cycles auto → light → dark, persists the choice, and repaints every
// toggle's icon/label to match.
const cycleTheme = (): void => {
  let stored: string | null = null;
  try {
    // localStorage can throw on file:// or in hardened contexts.
    stored = localStorage.getItem("mdxr-theme");
  } catch {
    stored = null;
  }
  const mode = stored === "light" || stored === "dark" ? stored : "auto";
  let next = "auto";
  if (mode === "auto") {
    next = "light";
  } else if (mode === "light") {
    next = "dark";
  }
  try {
    if (next === "auto") {
      localStorage.removeItem("mdxr-theme");
    } else {
      localStorage.setItem("mdxr-theme", next);
    }
  } catch {
    // Persistence is best-effort; the toggle still applies for this view.
  }
  const dark =
    next === "dark" ||
    (next === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  const title = `Theme: ${next}`;
  for (const b of document.querySelectorAll("[data-mdxr-theme]")) {
    if (!(b instanceof HTMLElement)) {
      continue;
    }
    b.dataset.mode = next;
    b.setAttribute("title", title);
    b.setAttribute("aria-label", `Switch theme (current: ${next})`);
  }
};

/**
 * Delegated handler for the document's interactive bits. On `input`/`change`
 * inside an `[data-ask]` block it rewrites the block's `[data-ask-output]`
 * Markdown answer sheet (`- **label**: answer` lines under `# title`, built
 * from `data-q-label`/`data-q-type` on each `[data-mdxr-q]` wrapper). On
 * `click`: `[data-copy]` copies a fixed string; `[data-ask-copy]` copies the
 * sheet; `[data-ask-save]` downloads it as a `.md` file; `[data-mdxr-theme]`
 * cycles the document theme auto → light → dark (persisted to localStorage,
 * so THEME_JS can restore it before first paint). Inlined into documents via
 * `CLIENT_JS` (`toString`) and registered by the Storybook preview, so it
 * must stay self-contained — no imports, no outer-scope references beyond
 * the `CLIENT_FNS` helpers.
 */
export const handleDocEvent = (e: Event): void => {
  const el = e.target;
  if (!(el instanceof Element)) {
    return;
  }
  // Field edits keep the Markdown pane live; the init pass in CLIENT_JS
  // seeds it by bubbling a synthetic `input` event off each [data-ask].
  if (e.type === "input" || e.type === "change") {
    const box = el.closest("[data-ask]");
    if (box instanceof HTMLElement) {
      syncAsk(box);
    }
    return;
  }
  const copyBtn = el.closest("[data-copy]");
  if (copyBtn instanceof HTMLElement) {
    copyWithFeedback(
      copyBtn,
      copyBtn.dataset.copy ?? "",
      "Copied",
      "Copy failed"
    );
    return;
  }
  const askBtn = el.closest("[data-ask-copy]");
  if (askBtn instanceof HTMLElement) {
    const box = askBtn.closest("[data-ask]");
    if (!(box instanceof HTMLElement)) {
      return;
    }
    // Re-collect on click too: autofill/programmatic edits fire no events.
    syncAsk(box);
    copyWithFeedback(askBtn, askMarkdown(box));
    return;
  }
  const askSaveBtn = el.closest("[data-ask-save]");
  if (askSaveBtn instanceof HTMLElement) {
    const box = askSaveBtn.closest("[data-ask]");
    if (box instanceof HTMLElement) {
      saveAsk(box, askSaveBtn);
    }
    return;
  }
  const themeBtn = el.closest("[data-mdxr-theme]");
  if (themeBtn instanceof HTMLElement) {
    cycleTheme();
  }
};

// Everything the emitted document script needs beyond `handleDocEvent`:
// helpers are emitted as top-level `const <name> = <fn>` declarations, in
// dependency order, so the handler's references resolve identically in the
// inlined script and in the Storybook preview's module scope.
const CLIENT_FNS = [
  flash,
  writeClipboard,
  copyWithFeedback,
  choiceText,
  multiAnswer,
  choiceAnswer,
  selectAnswer,
  fieldAnswer,
  answerOf,
  askMarkdown,
  syncAsk,
  saveAsk,
  cycleTheme,
];

/** Small vanilla JS inlined into every document: copy/answer/save buttons,
 * the live Markdown answer sheet, and theme. The trailing pass seeds each
 * Ask output pane (default-checked fields count as answers) by bubbling a
 * synthetic `input` event off the block — the delegated handler's own
 * input branch does the render, so no code is duplicated. */
export const CLIENT_JS = `${CLIENT_FNS.map(
  (f) => `const ${f.name} = ${f.toString()};`
).join("\n")}
document.addEventListener('click', ${handleDocEvent.toString()});
document.addEventListener('input', ${handleDocEvent.toString()});
document.addEventListener('change', ${handleDocEvent.toString()});
for (const b of document.querySelectorAll('[data-ask]')) {
  b.dispatchEvent(new Event('input', { bubbles: true }));
}`;

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

/** Live-reload snippet injected by \`mdxr serve\` only. */
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
document.documentElement.classList.toggle(
  'dark',
  stored === 'dark' || (stored !== 'light' && q.matches)
);
q.addEventListener('change', function (e) {
  var s = null;
  try { s = localStorage.getItem('mdxr-theme'); } catch (e2) {}
  if (s !== 'light' && s !== 'dark') {
    document.documentElement.classList.toggle('dark', e.matches);
  }
});
// This script runs in <head>, before the toggle button is parsed —
// reflect the stored mode on it once the DOM exists.
addEventListener('DOMContentLoaded', function () {
  var s = null;
  try { s = localStorage.getItem('mdxr-theme'); } catch (e) {}
  var mode = s === 'light' || s === 'dark' ? s : 'auto';
  document.querySelectorAll('[data-mdxr-theme]').forEach(function (b) {
    if (!(b instanceof HTMLElement)) {
      return;
    }
    b.dataset.mode = mode;
    b.setAttribute('title', 'Theme: ' + mode);
    b.setAttribute('aria-label', 'Switch theme (current: ' + mode + ')');
  });
});
`;

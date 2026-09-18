/**
 * Client-side document interactions — plain DOM code, no React. Bundled
 * into every rendered document via `entry.ts` (esbuild → CLIENT_JS) and
 * imported live by the Storybook preview, which binds `handleDocEvent`
 * itself. Keep this module free of top-level side effects; entry.ts owns
 * listener registration.
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
 * so THEME_JS can restore it before first paint). `entry.ts` registers this
 * on click/input/change; the Storybook preview binds it directly.
 */
export const handleDocEvent = (e: Event): void => {
  const el = e.target;
  if (!(el instanceof Element)) {
    return;
  }
  // Field edits keep the Markdown pane live; the init pass in entry.ts
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

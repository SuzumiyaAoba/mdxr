import { formatAnswerSheet } from "../../ask-sheet.js";
import type { SheetEntry } from "../../ask-sheet.js";
import { closestEl, copyWithFeedback, flash } from "./shared.js";

// The text a reader actually selected for a choice/select answer: the
// choice card's visible label minus its description, or the <option> text.
// Falls back to the control's value when no text can be read.
const choiceText = (f: Element): string => {
  if (f instanceof HTMLOptionElement) {
    // Same whitespace collapse as SSR's choiceLabel — otherwise the live
    // sheet rewrites an SSR-seeded "a b" label as "a  b" on first sync.
    const t = (f.textContent ?? "").replaceAll(/\s+/gu, " ").trim();
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

const ANSWER_READERS: Record<string, (q: HTMLElement) => string> = {
  choice: choiceAnswer,
  multi: multiAnswer,
  select: selectAnswer,
};

// One question's answer: checked choices read as their visible text,
// selects as the chosen option's text, toggles as yes/no, free-form
// fields as their raw value. "" means unanswered.
const answerOf = (q: HTMLElement): string =>
  ANSWER_READERS[q.dataset.qType ?? ""]?.(q) ?? fieldAnswer(q);

// Serializes an [data-ask] block into the Markdown answer sheet shown in
// [data-ask-output]: `# title` then one `- **label**: answer` line per
// question, in DOM order. Unanswered fields stay blank; toggles are
// always answered (yes/no). Multi-line answers indent under their item.
// The line format is shared with SSR via ask-sheet.ts.
const askMarkdown = (box: HTMLElement): string => {
  const entries: SheetEntry[] = [];
  for (const q of box.querySelectorAll("[data-mdxr-q]")) {
    if (!(q instanceof HTMLElement)) {
      continue;
    }
    entries.push({ answer: answerOf(q), label: q.dataset.qLabel ?? "" });
  }
  return formatAnswerSheet(box.dataset.askTitle, entries);
};

// Re-renders the answer sheet into the block's [data-ask-output] pane.
export const syncAsk = (box: HTMLElement): void => {
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

export const handleAskClick = (el: Element): boolean => {
  const askBtn = closestEl(el, "[data-ask-copy]");
  if (askBtn !== null) {
    const box = closestEl(askBtn, "[data-ask]");
    if (box === null) {
      return true;
    }
    // Re-collect on click too: autofill/programmatic edits fire no events.
    syncAsk(box);
    copyWithFeedback(askBtn, askMarkdown(box));
    return true;
  }
  const askSaveBtn = closestEl(el, "[data-ask-save]");
  if (askSaveBtn === null) {
    return false;
  }
  const box = closestEl(askSaveBtn, "[data-ask]");
  if (box !== null) {
    saveAsk(box, askSaveBtn);
  }
  return true;
};

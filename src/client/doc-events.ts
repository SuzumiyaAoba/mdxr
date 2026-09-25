/**
 * Client-side document interactions — plain DOM code, no React. Bundled
 * into every rendered document via `entry.ts` (esbuild → CLIENT_JS) and
 * imported live by the Storybook preview, which binds `handleDocEvent`
 * itself. Keep this module free of top-level side effects; entry.ts owns
 * listener registration.
 */

import { formatAnswerSheet } from "../ask-sheet.js";
import type { SheetEntry } from "../ask-sheet.js";

/** `el.closest(sel)` narrowed to HTMLElement — misses and non-HTML hits (SVG) are null. */
const closestEl = (el: Element, sel: string): HTMLElement | null => {
  const hit = el.closest(sel);
  return hit instanceof HTMLElement ? hit : null;
};

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

export const writeClipboard = (
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
const syncAsk = (box: HTMLElement): void => {
  const out = box.querySelector("[data-ask-output]");
  if (out !== null) {
    out.textContent = askMarkdown(box);
  }
};

/* ---- Board: drag & drop, move buttons, markdown copy ----------------------
 * Cards are `draggable` and carry their props in `data-card-*` attributes,
 * so the current arrangement serializes straight back into `<Board>` markup
 * (`data-board-copy` copies it — paste it over the source block to persist
 * a reorganization). `[data-board-move]` buttons cover keyboards and touch
 * (HTML5 DnD is absent there). All of it is plain DOM work — no hydration.
 */

// The card mid-drag, or null. Non-null also gates dragover/drop handling so
// unrelated drags (files, text selections) keep their native behavior.
let draggedCard: HTMLElement | null = null;

const DROP_HINTS = ["mdxr-drop-before", "mdxr-drop-end", "mdxr-drop-lane"];

// A board's own lanes — a Board nested in a card's children belongs to the
// inner board, so `closest` on each candidate does the assignment.
const lanesOf = (board: HTMLElement): HTMLElement[] =>
  [...board.querySelectorAll("[data-board-lane]")].filter(
    (l): l is HTMLElement =>
      l instanceof HTMLElement && l.closest("[data-board]") === board
  );

// The lane's cards: direct children of its `[data-board-cards]` box.
const cardsOf = (lane: HTMLElement): HTMLElement[] => {
  const box = lane.querySelector(":scope > [data-board-cards]");
  if (box === null) {
    return [];
  }
  return [...box.children].filter(
    (c): c is HTMLElement =>
      c instanceof HTMLElement && Object.hasOwn(c.dataset, "boardCard")
  );
};

const clearDropHints = (board: HTMLElement): void => {
  for (const n of board.querySelectorAll(`.${DROP_HINTS.join(", .")}`)) {
    n.classList.remove(...DROP_HINTS);
  }
};

// After any move the lane counts and the move buttons' `disabled` state
// follow the DOM (first-lane cards can't go left, last-lane can't go right).
const syncBoard = (board: HTMLElement): void => {
  const lanes = lanesOf(board);
  for (const [i, lane] of lanes.entries()) {
    const cards = cardsOf(lane);
    const badge = lane.querySelector(":scope > header .mdxr-lane-count");
    if (badge !== null) {
      badge.textContent = String(cards.length);
    }
    for (const card of cards) {
      const prev = card.querySelector('[data-board-move="-1"]');
      const next = card.querySelector('[data-board-move="1"]');
      if (prev instanceof HTMLButtonElement) {
        prev.disabled = i === 0;
      }
      if (next instanceof HTMLButtonElement) {
        next.disabled = i === lanes.length - 1;
      }
    }
  }
};

/** Initial counts + move-button state for every board under `root`. */
export const syncBoards = (root: ParentNode): void => {
  for (const b of root.querySelectorAll("[data-board]")) {
    if (b instanceof HTMLElement) {
      syncBoard(b);
    }
  }
};

const moveCard = (card: HTMLElement, dir: number): void => {
  const board = closestEl(card, "[data-board]");
  const lane = closestEl(card, "[data-board-lane]");
  if (board === null || lane === null) {
    return;
  }
  const lanes = lanesOf(board);
  const target = lanes[lanes.indexOf(lane) + dir];
  target?.querySelector(":scope > [data-board-cards]")?.append(card);
  if (target !== undefined) {
    syncBoard(board);
  }
};

// The insertion point for a pointer at clientY: the first card whose
// vertical midpoint sits below it (the dragged card aside), i.e. "drop
// before this card"; null means append at the lane's end.
const dropBefore = (lane: HTMLElement, clientY: number): HTMLElement | null => {
  for (const c of cardsOf(lane)) {
    if (c === draggedCard) {
      continue;
    }
    const r = c.getBoundingClientRect();
    if (clientY < r.top + r.height / 2) {
      return c;
    }
  }
  return null;
};

// Attribute in the emitted markup, always `name="v"`: JSX decodes entities
// in attribute strings, so `&`/`"`/`<`/control chars escape as entities —
// the emitted markup stays expression-free (mdxr forbids JS expressions).
const jsxAttr = (name: string, value: string): string =>
  ` ${name}="${value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll("\n", "&#10;")
    .replaceAll("\r", "&#13;")
    .replaceAll("\t", "&#9;")}"`;

// Card children serialize as markdown text inside <BoardCard>…</BoardCard>:
// entities cover `&`/`<`/braces (JSX markers), backslash escapes cover
// markdown's inline specials and line-leading block markers, so the text
// re-parses as it reads. Formatting the children had is already lost —
// data-card-text is the flattened visible text.
const mdText = (s: string): string =>
  s
    .replaceAll("\\", "\\\\")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll("{", "&#123;")
    .replaceAll("}", "&#125;")
    .replaceAll(/(?<ch>[`*_[\]])/gu, "\\$<ch>")
    .replaceAll(
      /(?<bol>^|\n)(?<ws>[ \t]*)(?<mark>[-+>#])/gu,
      "$<bol>$<ws>\\$<mark>"
    )
    .replaceAll(
      /(?<bol>^|\n)(?<ws>[ \t]*)(?<num>\d+)(?<dot>[.)])(?=\s|$)/gu,
      "$<bol>$<ws>$<num>\\$<dot>"
    );

// `[attr name, dataset key]` in emitted order: title first (required),
// then the chips in their rendered order.
const CARD_ATTRS = [
  ["status", "cardStatus"],
  ["priority", "cardPriority"],
  ["effort", "cardEffort"],
  ["owner", "cardOwner"],
  ["due", "cardDue"],
] as const;

// Serializes a board's current DOM into `<Board>`/`<Lane>`/`<BoardCard>`
// markup — the source form, so pasting it back persists the arrangement.
const boardMarkdown = (board: HTMLElement): string => {
  const attr = (name: string, value: string | undefined): string =>
    value === undefined || value === "" ? "" : jsxAttr(name, value);
  const lines = [`<Board${attr("title", board.dataset.boardTitle)}>`];
  for (const lane of lanesOf(board)) {
    lines.push(
      `  <Lane${attr("title", lane.dataset.laneTitle)}${attr("status", lane.dataset.laneStatus)}>`
    );
    for (const card of cardsOf(lane)) {
      const d = card.dataset;
      const attrs = CARD_ATTRS.map(([name, key]) => attr(name, d[key])).join(
        ""
      );
      const open = `    <BoardCard${attr("title", d.cardTitle)}${attrs}`;
      lines.push(
        d.cardText === undefined || d.cardText === ""
          ? `${open} />`
          : `${open}>${mdText(d.cardText)}</BoardCard>`
      );
    }
    lines.push("  </Lane>");
  }
  lines.push("</Board>");
  return lines.join("\n");
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

// localStorage can throw on file:// or in hardened contexts — reads fall
// back to "auto", writes are best-effort (the toggle still applies for
// this view).
const storedTheme = (): string => {
  try {
    return localStorage.getItem("mdxr-theme") ?? "auto";
  } catch {
    return "auto";
  }
};

const persistTheme = (mode: string): void => {
  try {
    if (mode === "auto") {
      localStorage.removeItem("mdxr-theme");
    } else {
      localStorage.setItem("mdxr-theme", mode);
    }
  } catch {
    // Best-effort — see above.
  }
};

const NEXT_MODE: Record<string, string> = {
  auto: "light",
  dark: "auto",
  light: "dark",
};

// Cycles auto → light → dark, persists the choice, and repaints every
// toggle's icon/label to match.
const cycleTheme = (): void => {
  const stored = storedTheme();
  const mode = stored === "light" || stored === "dark" ? stored : "auto";
  const next = NEXT_MODE[mode] ?? "auto";
  persistTheme(next);
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

// The lane + home board when `el` sits over a valid drop target for the
// active drag — lanes of the dragged card's own board only, not other
// boards and not the gaps between lanes.
const dragLane = (
  el: Element
): { home: HTMLElement; lane: HTMLElement } | null => {
  if (draggedCard === null) {
    return null;
  }
  const home = closestEl(draggedCard, "[data-board]");
  const lane = closestEl(el, "[data-board-lane]");
  if (home === null || lane === null || lane.closest("[data-board]") !== home) {
    return null;
  }
  return { home, lane };
};

const dragStart = (e: Event, el: Element): boolean => {
  const card = closestEl(el, "[data-board-card]");
  if (card === null || card.closest("[data-board]") === null) {
    return false;
  }
  draggedCard = card;
  if (e instanceof DragEvent && e.dataTransfer !== null) {
    e.dataTransfer.effectAllowed = "move";
    // Firefox won't start a drag without setData.
    e.dataTransfer.setData("text/plain", card.dataset.cardTitle ?? "");
  }
  // Defer so the drag image keeps the card's normal look. Re-check the
  // active drag: a same-frame drop/dragend would otherwise leave a stale
  // mdxr-drag class behind after dragFinish already ran.
  requestAnimationFrame(() => {
    if (draggedCard === card) {
      card.classList.add("mdxr-drag");
    }
  });
  return true;
};

// Ends the active drag — drop/dragend both land here; `home` clears the
// insertion-point hints when known.
const dragFinish = (home: HTMLElement | null): void => {
  if (draggedCard === null) {
    return;
  }
  draggedCard.classList.remove("mdxr-drag");
  if (home !== null) {
    clearDropHints(home);
  }
  draggedCard = null;
};

const dragOver = (e: Event, el: Element): boolean => {
  if (draggedCard === null) {
    return false;
  }
  const target = dragLane(el);
  const home = closestEl(draggedCard, "[data-board]");
  if (target === null) {
    // Off the lanes: clear stale hints, keep the no-drop cursor.
    if (home !== null) {
      clearDropHints(home);
    }
    return true;
  }
  e.preventDefault();
  const box = target.lane.querySelector(":scope > [data-board-cards]");
  if (box === null) {
    return true;
  }
  if (e instanceof DragEvent && e.dataTransfer !== null) {
    e.dataTransfer.dropEffect = "move";
  }
  const before = dropBefore(
    target.lane,
    e instanceof DragEvent ? e.clientY : 0
  );
  clearDropHints(target.home);
  target.lane.classList.add("mdxr-drop-lane");
  if (before === null) {
    box.classList.add("mdxr-drop-end");
  } else {
    before.classList.add("mdxr-drop-before");
  }
  return true;
};

const drop = (e: Event, el: Element): boolean => {
  if (draggedCard === null) {
    return false;
  }
  const target = dragLane(el);
  if (target === null) {
    // Keep the card's text out of fields/links outside the board.
    e.preventDefault();
    dragFinish(closestEl(draggedCard, "[data-board]"));
    return true;
  }
  e.preventDefault();
  const box = target.lane.querySelector(":scope > [data-board-cards]");
  const before = dropBefore(
    target.lane,
    e instanceof DragEvent ? e.clientY : 0
  );
  if (box !== null) {
    if (before === null) {
      box.append(draggedCard);
    } else {
      before.before(draggedCard);
    }
  }
  dragFinish(target.home);
  syncBoard(target.home);
  return true;
};

/* ---- Comments: line anchors, reply form, markdown copy -------------------
 * <Comments> markup carries the hooks: [data-mdxr-comment] cards inside
 * [data-comment-strip] threads, a [data-comment-add] "+" on every code/diff
 * row, [data-thread-tools] holding each thread's Reply affordance, and
 * [data-comments-copy] on the block's tools row. The strip/card/form markup
 * ships in hidden, inert [data-comment-tpl] containers inside the
 * [data-comments] root — handlers clone them so client-built markup stays
 * single-sourced in SSR. [data-comments-copy] serializes the block's DOM
 * back into <Comments> markup — paste it over the source block to persist
 * a review.
 */

interface CommentAnchor {
  file?: string;
  lines?: string;
  side?: string;
}

// Mirrors owner.tsx's initials — the client bundle can't reach the React
// helper without dragging the component tree into the IIFE.
const commentInitials = (name: string): string => {
  const clean = name.replace(/^@+/u, "").trim();
  const parts = clean.split(/[\s._-]+/u).filter(Boolean);
  const chars =
    parts.length > 0
      ? parts.slice(0, 2).map((w) => w.charAt(0))
      : [clean.charAt(0)];
  return chars.join("").toUpperCase();
};

// dataset writes skip empty/undefined values — `d.k = undefined` would set
// the literal "undefined" attribute.
const dataName = (key: string): string =>
  `data-${key.replaceAll(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`)}`;

const setData = (
  el: HTMLElement,
  key: string,
  value: string | undefined
): void => {
  if (value === undefined || value === "") {
    el.removeAttribute(dataName(key));
  } else {
    el.setAttribute(dataName(key), value);
  }
};

// Clone one [data-comment-tpl] fragment parked inside `root`
// (the [data-comments] block). Returns the fragment's single root element.
// Read native template content too, for previously generated documents.
const cloneTpl = (root: HTMLElement, kind: string): HTMLElement | null => {
  const tpl = root.querySelector(`[data-comment-tpl="${kind}"]`);
  if (!(tpl instanceof HTMLElement)) {
    return null;
  }
  const content = tpl instanceof HTMLTemplateElement ? tpl.content : tpl;
  const node = content.firstElementChild?.cloneNode(true);
  return node instanceof HTMLElement ? node : null;
};

// The strip's own anchor (replies inherit it): data-strip-* the SSR set
// from the thread's last comment.
const anchorOfStrip = (strip: HTMLElement): CommentAnchor => ({
  file: strip.dataset.stripFile,
  lines: strip.dataset.stripLines,
  side: strip.dataset.stripSide,
});

// Append a cloned comment form to `strip`, hiding its Reply tools until the
// form closes. A strip already hosting a form just refocuses it.
const openCommentForm = (
  root: HTMLElement,
  strip: HTMLElement,
  anchor: CommentAnchor
): void => {
  const live = strip.querySelector(":scope > [data-comment-form]");
  if (live instanceof HTMLElement) {
    live.querySelector("textarea")?.focus();
    return;
  }
  const form = cloneTpl(root, "form");
  if (form === null) {
    return;
  }
  setData(form, "formFile", anchor.file);
  setData(form, "formLines", anchor.lines);
  setData(form, "formSide", anchor.side);
  const tools = strip.querySelector(":scope > [data-thread-tools]");
  if (tools instanceof HTMLElement) {
    tools.hidden = true;
  }
  strip.append(form);
  form.querySelector("textarea")?.focus();
};

// Remove the form and bring back the strip's Reply tools. A strip with no
// cards left is one "+" opened and the user abandoned — drop it entirely
// and hand focus back to the row's "+".
const closeCommentForm = (form: HTMLElement): void => {
  const strip = form.parentElement;
  form.remove();
  if (
    !(strip instanceof HTMLElement) ||
    !Object.hasOwn(strip.dataset, "commentStrip")
  ) {
    return;
  }
  if (strip.querySelector("[data-mdxr-comment]") === null) {
    const add =
      strip.previousElementSibling?.querySelector("[data-comment-add]");
    strip.remove();
    if (add instanceof HTMLElement) {
      add.focus();
    }
    return;
  }
  const tools = strip.querySelector(":scope > [data-thread-tools]");
  if (!(tools instanceof HTMLElement)) {
    return;
  }
  tools.hidden = false;
  const reply = tools.querySelector("[data-comment-reply]");
  if (reply instanceof HTMLElement) {
    reply.focus();
  }
};

// Fill one [data-cc-*] slot with text — unused slots leave the clone so the
// built card matches SSR markup (no empty spans/avatar).
const fillSlot = (
  card: HTMLElement,
  slot: string,
  value: string | undefined
): void => {
  const el = card.querySelector(slot);
  if (value === undefined || value === "") {
    el?.remove();
    return;
  }
  if (el !== null) {
    el.textContent = value;
  }
};

// Build a [data-mdxr-comment] card off the `card` template: header slots
// filled from the anchor + author, body split into <p> paragraphs, and the
// data-comment-* attributes the markdown serializer reads.
const buildCommentCard = (
  root: HTMLElement,
  anchor: CommentAnchor,
  author: string,
  text: string
): HTMLElement | null => {
  const card = cloneTpl(root, "card");
  if (card === null) {
    return null;
  }
  setData(card, "commentAuthor", author);
  setData(card, "commentFile", anchor.file);
  setData(card, "commentLines", anchor.lines);
  setData(card, "commentSide", anchor.side === "old" ? "old" : undefined);
  setData(card, "commentText", text);
  fillSlot(card, "[data-cc-name]", author.replace(/^@+/u, ""));
  fillSlot(
    card,
    "[data-cc-lines]",
    anchor.lines === undefined ? undefined : `:${anchor.lines}`
  );
  if (anchor.side !== "old") {
    card.querySelector("[data-cc-old]")?.remove();
  }
  if (author === "") {
    card.querySelector("[data-cc-avatar]")?.remove();
  } else {
    card.querySelector("[data-cc-avatar-anon]")?.remove();
    fillSlot(card, "[data-cc-avatar]", commentInitials(author));
  }
  const body = card.querySelector("[data-cc-body]");
  for (const para of text.split(/\n{2,}/u)) {
    const p = document.createElement("p");
    p.textContent = para;
    body?.append(p);
  }
  return card;
};

const submitCommentForm = (form: HTMLElement): void => {
  const strip = closestEl(form, "[data-comment-strip]");
  const root = closestEl(form, "[data-comments]");
  const input = form.querySelector("[data-comment-input]");
  const nameField = form.querySelector("[data-comment-author]");
  if (
    strip === null ||
    root === null ||
    !(input instanceof HTMLTextAreaElement)
  ) {
    return;
  }
  const text = input.value.trim();
  if (text === "") {
    input.focus();
    return;
  }
  const card = buildCommentCard(
    root,
    {
      file: form.dataset.formFile,
      lines: form.dataset.formLines,
      side: form.dataset.formSide,
    },
    nameField instanceof HTMLInputElement ? nameField.value.trim() : "",
    text
  );
  if (card === null) {
    return;
  }
  // New cards land ahead of the tools row — last in the thread.
  const tools = strip.querySelector(":scope > [data-thread-tools]");
  if (tools === null) {
    strip.append(card);
  } else {
    tools.before(card);
  }
  closeCommentForm(form);
};

// The thread strip under a line row: the one already there (its anchor
// stands), else a fresh clone inserted after the row carrying the "+"
// button's anchor.
const stripAfterRow = (
  row: HTMLElement,
  root: HTMLElement,
  anchor: CommentAnchor
): HTMLElement | null => {
  const next = row.nextElementSibling;
  if (
    next instanceof HTMLElement &&
    Object.hasOwn(next.dataset, "commentStrip")
  ) {
    return next;
  }
  const strip = cloneTpl(root, "strip");
  if (strip === null) {
    return null;
  }
  setData(strip, "stripLines", anchor.lines);
  setData(strip, "stripSide", anchor.side);
  setData(strip, "stripFile", anchor.file);
  row.after(strip);
  return strip;
};

// "+" on a code/diff row: open the form in the row's strip, anchored to the
// button's line (and side/file for diffs). An existing strip under the row
// absorbs the new comment — GitHub keeps one thread per line.
const openLineComment = (btn: HTMLElement): void => {
  const row = closestEl(btn, "[data-comment-row]");
  const root = closestEl(btn, "[data-comments]");
  if (row === null || root === null) {
    return;
  }
  const anchor: CommentAnchor = {
    file: btn.dataset.file,
    lines: btn.dataset.commentAdd,
    side: btn.dataset.side,
  };
  const strip = stripAfterRow(row, root, anchor);
  if (strip !== null) {
    openCommentForm(root, strip, anchor);
  }
};

// `<Comment>` attrs in emitted order — [attribute name, dataset key].
const COMMENT_ATTRS = [
  ["author", "commentAuthor"],
  ["file", "commentFile"],
  ["href", "commentHref"],
  ["lines", "commentLines"],
  ["severity", "commentSeverity"],
  ["side", "commentSide"],
  ["title", "commentTitle"],
] as const;

// A fence that survives backtick runs inside the code — one tick longer
// than the longest run (three minimum).
const fenceFor = (code: string): string => {
  let max = 0;
  for (const m of code.matchAll(/`+/gu)) {
    max = Math.max(max, m[0].length);
  }
  return "`".repeat(Math.max(3, max + 1));
};

// Serialize a [data-comments] block back into <Comments> markup — the
// source form, so pasting it over the source block persists the review.
// The fence round-trips verbatim (lang + raw meta + text on the root's
// data-comments-*); every card re-emits its data-comment-* attributes, DOM
// order preserving thread order.
const commentsMarkdown = (root: HTMLElement): string => {
  const out = ["<Comments>", ""];
  const code = (root.dataset.commentsCode ?? "").replace(/\n$/u, "");
  const lang = root.dataset.commentsLang ?? "";
  const meta = root.dataset.commentsMeta ?? "";
  if (code !== "") {
    const fence = fenceFor(code);
    out.push(
      `${fence}${lang}${meta === "" ? "" : ` ${meta}`}`,
      code,
      fence,
      ""
    );
  }
  for (const c of root.querySelectorAll("[data-mdxr-comment]")) {
    // The card skeleton must not serialize as a phantom comment.
    if (
      !(c instanceof HTMLElement) ||
      c.closest("[data-comment-tpl]") !== null
    ) {
      continue;
    }
    const d = c.dataset;
    const attrs = COMMENT_ATTRS.map(([name, key]) => {
      const v = d[key];
      return v === undefined || v === "" ? "" : jsxAttr(name, v);
    }).join("");
    const text = d.commentText ?? "";
    out.push(
      text === ""
        ? `<Comment${attrs} />`
        : `<Comment${attrs}>${mdText(text)}</Comment>`
    );
  }
  out.push("", "</Comments>");
  return out.join("\n");
};

// Comments clicks: "+" line buttons, thread Reply, form Cancel/Comment, the
// block's Copy markdown.
const handleCommentsClick = (el: Element): boolean => {
  const addBtn = closestEl(el, "[data-comment-add]");
  if (addBtn !== null) {
    openLineComment(addBtn);
    return true;
  }
  const replyBtn = closestEl(el, "[data-comment-reply]");
  if (replyBtn !== null) {
    const strip = closestEl(replyBtn, "[data-comment-strip]");
    const root = closestEl(replyBtn, "[data-comments]");
    if (strip !== null && root !== null) {
      openCommentForm(root, strip, anchorOfStrip(strip));
    }
    return true;
  }
  const cancelBtn = closestEl(el, "[data-comment-cancel]");
  if (cancelBtn !== null) {
    const form = closestEl(cancelBtn, "[data-comment-form]");
    if (form !== null) {
      closeCommentForm(form);
    }
    return true;
  }
  const submitBtn = closestEl(el, "[data-comment-submit]");
  if (submitBtn !== null) {
    const form = closestEl(submitBtn, "[data-comment-form]");
    if (form !== null) {
      submitCommentForm(form);
    }
    return true;
  }
  const copyBtn = closestEl(el, "[data-comments-copy]");
  if (copyBtn === null) {
    return false;
  }
  const root = closestEl(copyBtn, "[data-comments]");
  if (root !== null) {
    copyWithFeedback(copyBtn, commentsMarkdown(root));
  }
  return true;
};

// Comment clicks plus the form's keydown: Cmd/Ctrl+Enter submits, Esc
// cancels — GitHub's comment-box shortcuts.
const handleComments = (e: Event, el: Element): boolean => {
  if (e.type === "click") {
    return handleCommentsClick(el);
  }
  if (e.type !== "keydown" || !(e instanceof KeyboardEvent)) {
    return false;
  }
  const form = closestEl(el, "[data-comment-form]");
  if (form === null) {
    return false;
  }
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    submitCommentForm(form);
    return true;
  }
  if (e.key === "Escape") {
    closeCommentForm(form);
    return true;
  }
  return false;
};

// Board clicks: per-card lane move buttons and the markdown copy.
const handleBoardClick = (el: Element): boolean => {
  const moveBtn = el.closest("[data-board-move]");
  if (moveBtn instanceof HTMLButtonElement) {
    const card = closestEl(moveBtn, "[data-board-card]");
    if (card !== null && !moveBtn.disabled) {
      moveCard(card, moveBtn.dataset.boardMove === "-1" ? -1 : 1);
    }
    return true;
  }
  const boardCopyBtn = closestEl(el, "[data-board-copy]");
  if (boardCopyBtn === null) {
    return false;
  }
  const board = closestEl(boardCopyBtn, "[data-board]");
  if (board !== null) {
    copyWithFeedback(boardCopyBtn, boardMarkdown(board));
  }
  return true;
};

// Card drag lifecycle + board clicks: dragstart arms `draggedCard`;
// dragover marks the insertion point and allows the drop; drop moves the
// card; dragend covers aborted drags (the source always gets it, drop or
// not); clicks hit the move buttons or the markdown copy. Returns true
// when the event was consumed.
const handleBoard = (e: Event, el: Element): boolean => {
  if (e.type === "click") {
    return handleBoardClick(el);
  }
  if (e.type === "dragstart") {
    return dragStart(e, el);
  }
  if (e.type === "dragover") {
    return dragOver(e, el);
  }
  if (e.type === "drop") {
    return drop(e, el);
  }
  if (e.type !== "dragend" || draggedCard === null) {
    return false;
  }
  dragFinish(closestEl(draggedCard, "[data-board]"));
  return true;
};

// Click handling once board/comments had their pass: generic copy, ask
// copy/save, theme cycle.
const handleDocClick = (el: Element): void => {
  const copyBtn = closestEl(el, "[data-copy]");
  if (copyBtn !== null) {
    copyWithFeedback(
      copyBtn,
      copyBtn.dataset.copy ?? "",
      "Copied",
      "Copy failed"
    );
    return;
  }
  const askBtn = closestEl(el, "[data-ask-copy]");
  if (askBtn !== null) {
    const box = closestEl(askBtn, "[data-ask]");
    if (box === null) {
      return;
    }
    // Re-collect on click too: autofill/programmatic edits fire no events.
    syncAsk(box);
    copyWithFeedback(askBtn, askMarkdown(box));
    return;
  }
  const askSaveBtn = closestEl(el, "[data-ask-save]");
  if (askSaveBtn !== null) {
    const box = closestEl(askSaveBtn, "[data-ask]");
    if (box !== null) {
      saveAsk(box, askSaveBtn);
    }
    return;
  }
  const themeBtn = closestEl(el, "[data-mdxr-theme]");
  if (themeBtn !== null) {
    cycleTheme();
  }
};

/**
 * Delegated handler for the document's interactive bits. On `input`/`change`
 * inside an `[data-ask]` block it rewrites the block's `[data-ask-output]`
 * Markdown answer sheet (`- **label**: answer` lines under `# title`, built
 * from `data-q-label`/`data-q-type` on each `[data-mdxr-q]` wrapper). On
 * `click`: `[data-copy]` copies a fixed string; `[data-ask-copy]` copies the
 * sheet; `[data-ask-save]` downloads it as a `.md` file; `[data-board-move]`
 * shifts a card a lane over; `[data-board-copy]` copies the board's current
 * `<Board>` markup; `[data-comment-*]` covers add/reply/cancel/submit and
 * `[data-comments-copy]` the block's `<Comments>` markup;
 * `[data-mdxr-theme]` cycles the document theme auto → light → dark
 * (persisted to localStorage, so THEME_JS can restore it before first
 * paint). The `drag*` types drive the board's card drag & drop, `keydown`
 * the comment form's submit/cancel shortcuts. `entry.ts` registers this on
 * click/input/change/keydown/dragstart/dragover/drop/dragend; the Storybook
 * preview binds it directly.
 */
export const handleDocEvent = (e: Event): void => {
  const el = e.target;
  if (!(el instanceof Element)) {
    return;
  }
  if (handleBoard(e, el)) {
    return;
  }
  if (handleComments(e, el)) {
    return;
  }
  // Field edits keep the Markdown pane live; the init pass in entry.ts
  // seeds it by bubbling a synthetic `input` event off each [data-ask].
  if (e.type === "input" || e.type === "change") {
    const box = closestEl(el, "[data-ask]");
    if (box !== null) {
      syncAsk(box);
    }
    return;
  }
  if (e.type === "click") {
    handleDocClick(el);
  }
};

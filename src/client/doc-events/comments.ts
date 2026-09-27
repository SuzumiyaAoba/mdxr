import { jsxAttr, mdText } from "./serialization.js";
import { closestEl, copyWithFeedback } from "./shared.js";

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
export const handleComments = (e: Event, el: Element): boolean => {
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

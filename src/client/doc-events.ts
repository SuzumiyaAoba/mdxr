/**
 * Client-side document interactions — plain DOM code, no React. Bundled
 * into every rendered document via `entry.ts` (esbuild → CLIENT_JS) and
 * imported live by the Storybook preview, which binds `handleDocEvent`
 * itself. Keep this module free of top-level side effects; entry.ts owns
 * listener registration.
 */

import { handleAskClick, syncAsk } from "./doc-events/ask.js";
import { handleBoard } from "./doc-events/board.js";
import { handleComments } from "./doc-events/comments.js";
import { closestEl, copyWithFeedback } from "./doc-events/shared.js";

export { syncBoards } from "./doc-events/board.js";
export { writeClipboard } from "./doc-events/shared.js";

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
  if (handleAskClick(el)) {
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

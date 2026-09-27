import { jsxAttr, mdText } from "./serialization.js";
import { closestEl, copyWithFeedback } from "./shared.js";

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

// `[attr name, dataset key]` in emitted order: title first (required),
// then the chips in their rendered order.
const CARD_ATTRS = [
  ["status", "cardStatus"],
  ["priority", "cardPriority"],
  ["effort", "cardEffort"],
  ["owner", "cardOwner"],
  ["due", "cardDue"],
] as const;

const boardAttr = (name: string, value: string | undefined): string =>
  value === undefined || value === "" ? "" : jsxAttr(name, value);

// Serializes a board's current DOM into `<Board>`/`<Lane>`/`<BoardCard>`
// markup — the source form, so pasting it back persists the arrangement.
const boardMarkdown = (board: HTMLElement): string => {
  const lines = [`<Board${boardAttr("title", board.dataset.boardTitle)}>`];
  for (const lane of lanesOf(board)) {
    lines.push(
      `  <Lane${boardAttr("title", lane.dataset.laneTitle)}${boardAttr("status", lane.dataset.laneStatus)}>`
    );
    for (const card of cardsOf(lane)) {
      const d = card.dataset;
      const attrs = CARD_ATTRS.map(([name, key]) =>
        boardAttr(name, d[key])
      ).join("");
      const open = `    <BoardCard${boardAttr("title", d.cardTitle)}${attrs}`;
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
export const handleBoard = (e: Event, el: Element): boolean => {
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

import type { WidgetRecord } from "../widget-state.js";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
interface WidgetControl {
  element: HTMLElement;
  record: () => WidgetRecord;
  restore: (saved: WidgetRecord) => void;
}
const controlsOf = (question: Element): Control[] =>
  [...question.querySelectorAll("input,select,textarea")].filter(
    (element): element is Control =>
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
  );
const ownElements = (board: Element, selector: string): HTMLElement[] =>
  [...board.querySelectorAll<HTMLElement>(selector)].filter(
    (element) => element.closest("[data-board]") === board
  );
const identityOf = (element: HTMLElement): string =>
  element.dataset.widgetIdentity ?? "";
const compareIds = (left: string, right: string): number =>
  left.localeCompare(right, "en");

const identify = (
  elements: HTMLElement[],
  attr: string,
  fallback: (element: HTMLElement) => string
): void => {
  const counts = new Map<string, number>();
  for (const element of elements) {
    const base = element.getAttribute(attr) ?? fallback(element);
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    element.dataset.widgetIdentity = `${base}:${count}`;
  }
};

const controlShape = (field: Control): unknown => {
  if (field instanceof HTMLSelectElement) {
    return [...field.options].map((option) => [
      option.value,
      option.textContent,
    ]);
  }
  if (
    field instanceof HTMLInputElement &&
    ["radio", "checkbox"].includes(field.type)
  ) {
    return [
      field.value,
      [...(field.labels ?? [])].map((label) => label.textContent),
    ];
  }
  return field.tagName;
};

const restoreQuestion = (
  question: HTMLElement,
  fields: Control[],
  saved: WidgetRecord
): void => {
  if (saved.values.length !== fields.length) {
    return;
  }
  for (const [index, field] of fields.entries()) {
    const value = saved.values[index];
    if (value === undefined) {
      continue;
    }
    // Choice values belong to the schema and must never be changed on restore.
    if (
      !(field instanceof HTMLInputElement) ||
      !["radio", "checkbox"].includes(field.type)
    ) {
      field.value = value.value;
    }
    if (field instanceof HTMLInputElement) {
      field.checked = value.checked;
    }
  }
  question.dispatchEvent(new Event("input", { bubbles: true }));
};

const questionWidget = (
  ask: HTMLElement,
  question: HTMLElement
): WidgetControl => {
  const fields = controlsOf(question);
  const key = `ask:${identityOf(ask)}:${identityOf(question)}`;
  const signature = JSON.stringify({
    label: question.dataset.qLabel,
    name: question.dataset.qName,
    options: fields.map(controlShape),
    type: question.dataset.qType,
  });
  return {
    element: question,
    record: () => ({
      key,
      kind: "question",
      lanes: [],
      signature,
      values: fields.map((field) => ({
        checked: field instanceof HTMLInputElement && field.checked,
        value: field.value,
      })),
    }),
    restore: (saved) => {
      restoreQuestion(question, fields, saved);
    },
  };
};

const laneCards = (lane: HTMLElement, board: HTMLElement): string[] =>
  [...(lane.querySelector(":scope > [data-board-cards]")?.children ?? [])]
    .filter(
      (card): card is HTMLElement =>
        card instanceof HTMLElement && card.closest("[data-board]") === board
    )
    .map(identityOf);

const restoreBoard = (
  lanes: HTMLElement[],
  cards: HTMLElement[],
  saved: WidgetRecord
): void => {
  for (const lane of saved.lanes) {
    const box = lanes
      .find((element) => identityOf(element) === lane.id)
      ?.querySelector(":scope > [data-board-cards]");
    for (const card of lane.cards) {
      const element = cards.find((candidate) => identityOf(candidate) === card);
      if (element !== undefined) {
        box?.append(element);
      }
    }
  }
};

const boardWidget = (board: HTMLElement): WidgetControl => {
  const lanes = ownElements(board, "[data-board-lane]");
  const cards = ownElements(board, "[data-board-card]");
  identify(lanes, "data-lane-id", (lane) => lane.dataset.laneTitle ?? "lane");
  identify(cards, "data-card-id", (card) =>
    JSON.stringify([
      card.dataset.cardTitle,
      card.dataset.cardText,
      card.dataset.cardOwner,
    ])
  );
  const key = `board:${identityOf(board)}`;
  const signature = JSON.stringify({
    cards: cards.map(identityOf).toSorted(compareIds),
    lanes: lanes.map(identityOf).toSorted(compareIds),
  });
  return {
    element: board,
    record: () => ({
      key,
      kind: "board",
      lanes: lanes.map((lane) => ({
        cards: laneCards(lane, board),
        id: identityOf(lane),
      })),
      signature,
      values: [],
    }),
    restore: (saved) => {
      restoreBoard(lanes, cards, saved);
    },
  };
};

export const createWidgets = (): Map<string, WidgetControl> => {
  const current = new Map<string, WidgetControl>();
  const asks = [
    ...document.querySelectorAll<HTMLElement>("#mdxr-root [data-ask]"),
  ];
  identify(asks, "data-ask-id", (ask) => ask.dataset.askTitle ?? "questions");
  for (const ask of asks) {
    const questions = [
      ...ask.querySelectorAll<HTMLElement>("[data-mdxr-q]"),
    ].filter((question) => question.closest("[data-ask]") === ask);
    identify(
      questions,
      "data-q-name",
      (question) => question.dataset.qLabel ?? "question"
    );
    for (const question of questions) {
      const widget = questionWidget(ask, question);
      current.set(widget.record().key, widget);
    }
  }
  const boards = [
    ...document.querySelectorAll<HTMLElement>("#mdxr-root [data-board]"),
  ];
  identify(
    boards,
    "data-board-id",
    (board) => board.dataset.boardTitle ?? "board"
  );
  for (const board of boards) {
    const widget = boardWidget(board);
    current.set(widget.record().key, widget);
  }
  return current;
};

import type { AnnotationAnchor } from "../annotations.js";
import { normalizeAnnotationText } from "../annotations.js";

const CONTROLS =
  "button,input,textarea,select,[contenteditable]:not([contenteditable='false']),[hidden],[inert]";
const BLOCKS = "p,li,blockquote,pre,h1,h2,h3,h4,h5,h6,td,th,figcaption";
const FIGURES =
  "figure,img,svg[role='img'],svg[aria-label],.mermaid,[data-mdxr-figure]";
const CONTEXT_LENGTH = 48;

const elementOf = (node: Node): Element | null =>
  node instanceof Element ? node : node.parentElement;

const elementPath = (root: Element, target: Element): number[] => {
  const result: number[] = [];
  let current: Element | null = target;
  while (current !== null && current !== root) {
    const parent: Element | null = current.parentElement;
    if (parent === null) {
      return [];
    }
    result.unshift([...parent.children].indexOf(current));
    current = parent;
  }
  return result;
};

const elementAt = (
  root: Element,
  path: readonly number[]
): Element | undefined => {
  let element: Element | undefined = root;
  for (const index of path) {
    element = element?.children.item(index) ?? undefined;
  }
  return element;
};

const headingOf = (root: Element, target: Node): string => {
  let heading = "";
  for (const element of root.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
    if (
      element.contains(target) ||
      // oxlint-disable-next-line no-bitwise -- compareDocumentPosition returns a DOM bitmask
      (element.compareDocumentPosition(target) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
        0
    ) {
      heading = normalizeAnnotationText(element.textContent ?? "");
    }
  }
  return heading;
};

export interface ResolvedAnnotation {
  element: Element;
  range?: Range;
}

/** Capture offsets against the nearest shared block, including inline markup. */
export const captureTextAnchor = (
  root: Element
): { anchor: AnnotationAnchor; target: ResolvedAnnotation } | undefined => {
  const selection = window.getSelection();
  if (
    selection === null ||
    selection.isCollapsed ||
    selection.rangeCount === 0
  ) {
    return undefined;
  }
  const range = selection.getRangeAt(0).cloneRange();
  if (
    !root.contains(range.startContainer) ||
    !root.contains(range.endContainer) ||
    elementOf(range.startContainer)?.closest(CONTROLS) !== null ||
    elementOf(range.endContainer)?.closest(CONTROLS) !== null
  ) {
    return undefined;
  }
  const quote = range.toString();
  if (quote.trim() === "") {
    return undefined;
  }
  const common = elementOf(range.commonAncestorContainer);
  const element = common?.closest(BLOCKS) ?? common;
  if (element === null || !root.contains(element)) {
    return undefined;
  }
  const before = range.cloneRange();
  before.selectNodeContents(element);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  const end = start + quote.length;
  const text = element.textContent ?? "";
  return {
    anchor: {
      end,
      heading: headingOf(root, range.startContainer),
      image: "",
      kind: "text",
      path: elementPath(root, element),
      prefix: text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
      quote,
      revision: "",
      start,
      suffix: text.slice(end, end + CONTEXT_LENGTH),
    },
    target: { element, range },
  };
};

/** Figures own their nested SVGs/images; decorative icons are never targets. */
export const annotationFigures = (root: Element): Element[] =>
  [...root.querySelectorAll(FIGURES)].filter(
    (element) =>
      element.closest(CONTROLS) === null &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.parentElement?.closest(FIGURES) === null
  );

export const figureLabel = (element: Element): string => {
  const caption = element.querySelector("figcaption");
  // Chart captions often also contain tool buttons; use their textual title.
  const title = caption?.querySelector("span") ?? caption;
  const image = element.matches("img") ? element : element.querySelector("img");
  return (
    normalizeAnnotationText(
      title?.textContent ??
        element.getAttribute("aria-label") ??
        image?.getAttribute("alt") ??
        element.querySelector("svg title")?.textContent ??
        element.textContent ??
        ""
    ).slice(0, 500) || "Untitled figure"
  );
};

const figureImage = (element: Element): string =>
  (element.matches("img")
    ? element
    : element.querySelector("img")
  )?.getAttribute("src") ?? "";

export const captureFigureAnchor = (
  root: Element,
  element: Element
): AnnotationAnchor => ({
  end: 0,
  heading: headingOf(root, element),
  image: figureImage(element),
  kind: "figure",
  path: elementPath(root, element),
  prefix: "",
  quote: figureLabel(element),
  revision: "",
  start: 0,
  suffix: "",
});

const rangeAt = (
  element: Element,
  start: number,
  end: number
): Range | undefined => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let offset = 0;
  let started = false;
  let node = walker.nextNode();
  while (node !== null) {
    const length = node.textContent?.length ?? 0;
    if (!started && start <= offset + length) {
      range.setStart(node, start - offset);
      started = true;
    }
    if (started && end <= offset + length) {
      range.setEnd(node, end - offset);
      return range;
    }
    offset += length;
    node = walker.nextNode();
  }
  return undefined;
};

const matchesContext = (
  text: string,
  start: number,
  anchor: AnnotationAnchor
): boolean =>
  text.slice(start, start + anchor.quote.length) === anchor.quote &&
  text.slice(Math.max(0, start - anchor.prefix.length), start) ===
    anchor.prefix &&
  text.slice(
    start + anchor.quote.length,
    start + anchor.quote.length + anchor.suffix.length
  ) === anchor.suffix;

const restoreText = (
  root: Element,
  anchor: AnnotationAnchor,
  revision: string
): ResolvedAnnotation | undefined => {
  const element = elementAt(root, anchor.path);
  if (
    anchor.revision === revision &&
    element !== undefined &&
    matchesContext(element.textContent ?? "", anchor.start, anchor)
  ) {
    const range = rangeAt(element, anchor.start, anchor.end);
    if (range?.toString() === anchor.quote) {
      return { element, range };
    }
  }
  // A rebuild may move blocks. Reattach only to a unique quote with context.
  const text = root.textContent ?? "";
  const matches: number[] = [];
  let start = text.indexOf(anchor.quote);
  while (anchor.quote !== "" && start !== -1) {
    if (matchesContext(text, start, anchor)) {
      matches.push(start);
    }
    start = text.indexOf(
      anchor.quote,
      start + Math.max(1, anchor.quote.length)
    );
  }
  const [offset] = matches;
  if (matches.length !== 1 || offset === undefined) {
    return undefined;
  }
  const range = rangeAt(root, offset, offset + anchor.quote.length);
  const target =
    range === undefined ? null : elementOf(range.commonAncestorContainer);
  return target === null ? undefined : { element: target, range };
};

export const resolveAnnotation = (
  root: Element,
  anchor: AnnotationAnchor,
  revision: string
): ResolvedAnnotation | undefined => {
  if (anchor.kind === "text") {
    return restoreText(root, anchor, revision);
  }
  const candidates = annotationFigures(root).filter(
    (element) =>
      figureLabel(element) === anchor.quote &&
      figureImage(element) === anchor.image &&
      headingOf(root, element) === anchor.heading
  );
  const original = elementAt(root, anchor.path);
  if (
    anchor.revision === revision &&
    original !== undefined &&
    candidates.includes(original)
  ) {
    return { element: original };
  }
  // Repeated unlabeled diagrams/images cannot safely be distinguished after edits.
  const [element] = candidates;
  return candidates.length === 1 && element !== undefined
    ? { element }
    : undefined;
};

export const targetRect = (target: ResolvedAnnotation): DOMRect =>
  target.range?.getBoundingClientRect() ??
  target.element.getBoundingClientRect();

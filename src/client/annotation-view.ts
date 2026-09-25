import { annotationLocation } from "../annotations.js";
import type { DocumentAnnotation } from "../annotations.js";
import type { ResolvedAnnotation } from "./annotation-anchors.js";
import { targetRect } from "./annotation-anchors.js";

const filename = (file: string): string => file.split(/[\\/]/u).at(-1) ?? file;

export const annotationView = (host: HTMLElement, file: string) => {
  const get = <T extends HTMLElement>(
    selector: string,
    type: new () => T
  ): T => {
    const element = host.querySelector(selector);
    if (!(element instanceof type)) {
      throw new Error(`Missing annotation control: ${selector}`);
    }
    return element;
  };
  const documentName = get("[data-annotation-document]", HTMLElement);
  documentName.textContent = filename(file);
  documentName.title = file;
  return {
    comment: get("[data-annotation-comment]", HTMLTextAreaElement),
    copy: get("[data-annotation-copy]", HTMLButtonElement),
    copyLabel: get("[data-annotation-copy-label]", HTMLElement),
    count: get("[data-annotation-count]", HTMLElement),
    draftQuote: get("[data-annotation-draft-quote]", HTMLElement),
    empty: get("[data-annotation-empty]", HTMLElement),
    export: get("[data-annotation-export]", HTMLElement),
    figure: get("[data-annotation-figure]", HTMLSelectElement),
    figurePicker: get("[data-annotation-figure-picker]", HTMLElement),
    form: get("[data-annotation-form]", HTMLFormElement),
    icons: get("[data-annotation-icons]", HTMLElement),
    list: get("[data-annotation-list]", HTMLElement),
    markdown: get("[data-annotation-markdown]", HTMLTextAreaElement),
    overlays: get("[data-annotation-overlays]", HTMLElement),
    panel: get("#mdxr-annotation-panel", HTMLElement),
    panelCount: get("[data-annotation-panel-count]", HTMLElement),
    pick: get("[data-annotation-pick]", HTMLButtonElement),
    save: get("[data-annotation-save]", HTMLButtonElement),
    selection: get("[data-annotation-selection]", HTMLButtonElement),
    status: get("[data-annotation-status]", HTMLElement),
    statusRow: get("[data-annotation-status-row]", HTMLElement),
    toggle: get("[data-annotation-toggle]", HTMLButtonElement),
    useFigure: get("[data-annotation-use-figure]", HTMLButtonElement),
  };
};

export type AnnotationView = ReturnType<typeof annotationView>;

/** Clone trusted, server-rendered Lucide SVGs; user content stays plain text. */
const annotationIcon = (view: AnnotationView, name: string): Node => {
  const template = view.icons.querySelector<HTMLTemplateElement>(
    `[data-annotation-icon="${name}"]`
  );
  return template?.content.cloneNode(true) ?? document.createTextNode("");
};

const textElement = <T extends keyof HTMLElementTagNameMap>(
  tag: T,
  text: string,
  className = ""
): HTMLElementTagNameMap[T] => {
  const element = document.createElement(tag);
  element.textContent = text;
  element.className = className;
  return element;
};

const actionButton = (
  view: AnnotationView,
  action: string,
  label: string,
  id: string
): HTMLButtonElement => {
  const button = textElement("button", "", "mdxr-annotation-icon-button");
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.append(annotationIcon(view, action));
  button.dataset.annotationAction = action;
  button.dataset.annotationId = id;
  return button;
};

export const renderAnnotationList = (
  view: AnnotationView,
  annotations: readonly DocumentAnnotation[],
  detached: ReadonlySet<string>,
  editingId?: string
): void => {
  const cards = annotations.map(({ id, comment, anchor }, index) => {
    const card = textElement("li", "", "mdxr-annotation-card");
    card.dataset.annotationCard = id;
    card.dataset.kind = anchor.kind;
    card.toggleAttribute("data-editing", editingId === id);
    const content = textElement("div", "", "mdxr-annotation-note-content");
    const reference = textElement("div", "", "mdxr-annotation-reference");
    const kind = textElement("span", "", "mdxr-annotation-kind");
    kind.setAttribute(
      "aria-label",
      anchor.kind === "text" ? "Text selection" : "Figure"
    );
    kind.append(annotationIcon(view, anchor.kind));
    card.append(
      textElement(
        "span",
        String(index + 1).padStart(2, "0"),
        "mdxr-annotation-number"
      )
    );
    const go = actionButton(view, "go", "Show target", id);
    go.disabled = detached.has(id);
    reference.append(kind, textElement("blockquote", anchor.quote), go);
    content.append(reference);
    if (detached.has(id)) {
      const warning = textElement("div", "", "mdxr-annotation-detached");
      warning.append(
        annotationIcon(view, "warning"),
        textElement("span", "Target unavailable")
      );
      warning.title =
        "The target changed or was removed. The original quote is preserved.";
      content.append(warning);
    }
    content.append(textElement("p", comment, "mdxr-annotation-comment-body"));
    const footer = textElement("div", "", "mdxr-annotation-card-footer");
    const location =
      anchor.source === undefined
        ? anchor.heading
        : annotationLocation(anchor.source);
    if (location !== "") {
      const source = textElement("span", "", "mdxr-annotation-location");
      source.title = location;
      source.setAttribute("aria-label", `Source: ${location}`);
      source.append(
        textElement(
          "span",
          anchor.source === undefined ? location : filename(location)
        )
      );
      footer.append(source);
    }
    const actions = textElement("div", "", "mdxr-annotation-actions");
    actions.append(
      actionButton(view, "edit", "Edit", id),
      actionButton(view, "delete", "Delete", id)
    );
    footer.append(actions);
    content.append(footer);
    card.append(content);
    return card;
  });
  view.list.replaceChildren(...cards);
  view.count.textContent = String(annotations.length);
  view.count.hidden = annotations.length === 0;
  view.panelCount.textContent = String(annotations.length);
  view.copy.disabled = annotations.length === 0;
  view.empty.hidden = annotations.length > 0 || view.form.hidden !== true;
};

const visibleRect = (rect: DOMRect): boolean =>
  rect.width > 0 &&
  rect.height > 0 &&
  rect.bottom > 0 &&
  rect.top < window.innerHeight &&
  rect.right > 0 &&
  rect.left < window.innerWidth;

export const paintAnnotationTargets = (
  view: AnnotationView,
  targets: readonly ResolvedAnnotation[],
  active?: ResolvedAnnotation
): void => {
  const supportsHighlight =
    typeof Highlight !== "undefined" && "highlights" in CSS;
  if (supportsHighlight) {
    CSS.highlights.set(
      "mdxr-annotations",
      new Highlight(
        ...targets.flatMap(({ range }) => (range === undefined ? [] : [range]))
      )
    );
    CSS.highlights.set(
      "mdxr-annotation-active",
      new Highlight(...(active?.range === undefined ? [] : [active.range]))
    );
  }
  const boxes: HTMLDivElement[] = [];
  const outline = (target: ResolvedAnnotation, selected: boolean): void => {
    if (supportsHighlight && target.range !== undefined) {
      return;
    }
    const rect = targetRect(target);
    if (!visibleRect(rect)) {
      return;
    }
    const box = document.createElement("div");
    box.className = "mdxr-annotation-outline";
    box.toggleAttribute("data-active", selected);
    box.style.left = `${rect.left - 3}px`;
    box.style.top = `${rect.top - 3}px`;
    box.style.width = `${rect.width + 6}px`;
    box.style.height = `${rect.height + 6}px`;
    boxes.push(box);
  };
  for (const target of targets) {
    outline(target, false);
  }
  if (active !== undefined) {
    outline(active, true);
  }
  view.overlays.replaceChildren(...boxes);
};

export const positionSelectionButton = (
  view: AnnotationView,
  target: ResolvedAnnotation
): void => {
  const rect = targetRect(target);
  view.selection.hidden = !visibleRect(rect);
  view.selection.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 140))}px`;
  view.selection.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 42))}px`;
};

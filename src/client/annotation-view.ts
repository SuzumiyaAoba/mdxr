import { annotationLocation, annotationStatus } from "../annotations.js";
import type {
  AnnotationBatch,
  AnnotationResolution,
  AnnotationStatus,
  DocumentAnnotation,
} from "../annotations.js";
import type { ResolvedAnnotation } from "./annotation-anchors.js";
import { targetRect } from "./annotation-anchors.js";
import { getAnnotationCopy } from "./annotation-copy.js";
import type { AnnotationCopy } from "./annotation-copy.js";

const filename = (file: string): string => file.split(/[\\/]/u).at(-1) ?? file;

const localizeAnnotationChrome = (
  host: HTMLElement,
  labels: AnnotationCopy
): void => {
  const setText = (selector: string, value: string): void => {
    const element = host.querySelector<HTMLElement>(selector);
    if (element !== null) {
      element.textContent = value;
    }
  };
  const setButton = (selector: string, label: string, title = label): void => {
    const button = host.querySelector<HTMLButtonElement>(selector);
    if (button !== null) {
      button.setAttribute("aria-label", label);
      button.title = title;
    }
  };

  host.lang = labels.dateLocale === "ja-JP" ? "ja" : "en";
  setText("[data-annotation-toggle-label]", labels.toggle);
  setText("#doc-annotation-title", labels.panelTitle);
  setText("[data-annotation-selection-label]", labels.addComment);
  setText("[data-annotation-figure-label]", labels.figureLabel);
  setText("[data-annotation-comment-label]", labels.commentLabel);
  setText("[data-annotation-filter-label]", labels.filterLabel);
  setText("[data-annotation-filter] [value='all']", labels.filterAll);
  setText("[data-annotation-filter] [value='open']", labels.filterOpen);
  setText("[data-annotation-filter] [value='resolved']", labels.filterResolved);
  setText("[data-annotation-empty]", labels.noComments);
  setText("[data-annotation-history-label]", labels.history);
  setText("[data-annotation-copy-label]", labels.copyMarkdown);
  setText("[data-annotation-send-label]", labels.sendToChat);
  setText("[data-annotation-markdown-label]", labels.markdownFeedback);

  const comment = host.querySelector<HTMLTextAreaElement>(
    "[data-annotation-comment]"
  );
  if (comment !== null) {
    comment.placeholder = labels.commentPlaceholder;
  }
  const form = host.querySelector<HTMLFormElement>("[data-annotation-form]");
  form?.setAttribute("aria-label", labels.newComment);
  setButton(
    "[data-annotation-save]",
    labels.saveComment,
    labels.saveTitle(labels.saveComment)
  );
  setButton("[data-annotation-toggle]", labels.toggle);
  setButton("[data-annotation-selection]", labels.addComment);
  setButton("[data-annotation-pick]", labels.selectFigure);
  setButton("[data-annotation-use-figure]", labels.commentOnFigure);
  setButton("[data-annotation-close]", labels.close, labels.closeTitle);
  setButton("[data-annotation-cancel]", labels.cancel);
  setButton("[data-annotation-copy]", labels.copyMarkdown);
  setButton("[data-annotation-send]", labels.sendToChat);
  const filter = host.querySelector<HTMLSelectElement>(
    "[data-annotation-filter]"
  );
  filter?.setAttribute("aria-label", labels.filterLabel);
};

export const annotationView = (
  host: HTMLElement,
  file: string,
  revision = ""
) => {
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
  const labels = getAnnotationCopy();
  localizeAnnotationChrome(host, labels);
  return {
    comment: get("[data-annotation-comment]", HTMLTextAreaElement),
    copy: get("[data-annotation-copy]", HTMLButtonElement),
    copyLabel: get("[data-annotation-copy-label]", HTMLElement),
    count: get("[data-annotation-count]", HTMLElement),
    currentRevision: revision,
    draftQuote: get("[data-annotation-draft-quote]", HTMLElement),
    empty: get("[data-annotation-empty]", HTMLElement),
    export: get("[data-annotation-export]", HTMLElement),
    figure: get("[data-annotation-figure]", HTMLSelectElement),
    figurePicker: get("[data-annotation-figure-picker]", HTMLElement),
    filter: get("[data-annotation-filter]", HTMLSelectElement),
    form: get("[data-annotation-form]", HTMLFormElement),
    history: get("[data-annotation-history]", HTMLDetailsElement),
    historyCount: get("[data-annotation-history-count]", HTMLElement),
    historyList: get("[data-annotation-history-list]", HTMLElement),
    icons: get("[data-annotation-icons]", HTMLElement),
    labels,
    list: get("[data-annotation-list]", HTMLElement),
    markdown: get("[data-annotation-markdown]", HTMLTextAreaElement),
    overlays: get("[data-annotation-overlays]", HTMLElement),
    panel: get("#doc-annotation-panel", HTMLElement),
    panelCount: get("[data-annotation-panel-count]", HTMLElement),
    pick: get("[data-annotation-pick]", HTMLButtonElement),
    save: get("[data-annotation-save]", HTMLButtonElement),
    selection: get("[data-annotation-selection]", HTMLButtonElement),
    send: get("[data-annotation-send]", HTMLButtonElement),
    status: get("[data-annotation-status]", HTMLElement),
    statusRow: get("[data-annotation-status-row]", HTMLElement),
    toggle: get("[data-annotation-toggle]", HTMLButtonElement),
    useFigure: get("[data-annotation-use-figure]", HTMLButtonElement),
  };
};

export type AnnotationView = ReturnType<typeof annotationView>;

export type AnnotationFilter = "all" | AnnotationStatus;

const annotationHistorySignatures = new WeakMap<HTMLElement, string>();

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
  const button = textElement("button", "", "doc-annotation-icon-button");
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.append(annotationIcon(view, action));
  button.dataset.annotationAction = action;
  button.dataset.annotationId = id;
  return button;
};

const resolutionDetails = (
  view: AnnotationView,
  resolution: AnnotationResolution
): HTMLElement => {
  const details = textElement("div", "", "doc-annotation-resolution");
  const timestamp = Date.parse(resolution.resolvedAt);
  const formattedDate = Number.isNaN(timestamp)
    ? resolution.resolvedAt
    : new Intl.DateTimeFormat(view.labels.dateLocale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(timestamp);
  const resolvedAt = textElement("time", view.labels.resolvedOn(formattedDate));
  resolvedAt.dateTime = resolution.resolvedAt;
  const shortRevision = resolution.revision.slice(0, 12);
  const revisionLabel = textElement(
    "span",
    view.labels.revisionLabel(shortRevision)
  );
  revisionLabel.title = view.labels.revisionLabel(resolution.revision);
  details.append(resolvedAt, revisionLabel);
  if (resolution.version !== undefined) {
    const link = textElement(
      "a",
      view.labels.viewResolvedVersion(resolution.version.sequence)
    );
    const historyUrl = new URL("/__doc_history", window.location.href);
    historyUrl.searchParams.set("view", "preview");
    historyUrl.searchParams.set("id", resolution.version.id);
    link.href = historyUrl.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "doc-annotation-version-link";
    details.append(link);
  }
  if (
    view.currentRevision !== "" &&
    resolution.revision !== view.currentRevision
  ) {
    details.append(
      textElement(
        "p",
        view.labels.updatedWarning,
        "doc-annotation-updated-warning"
      )
    );
  }
  return details;
};

export const renderAnnotationList = (
  view: AnnotationView,
  annotations: readonly DocumentAnnotation[],
  detached: ReadonlySet<string>,
  editingId?: string,
  filter: AnnotationFilter = "all",
  resolvingIds: ReadonlySet<string> = new Set()
): void => {
  const visibleAnnotations = annotations.filter(
    (annotation) => filter === "all" || annotationStatus(annotation) === filter
  );
  const cards = visibleAnnotations.map((annotation, index) => {
    const { id, comment, anchor, resolution } = annotation;
    const status = annotationStatus(annotation);
    const resolving = resolvingIds.has(id);
    const card = textElement("li", "", "doc-annotation-card");
    card.dataset.annotationCard = id;
    card.dataset.kind = anchor.kind;
    card.dataset.status = status;
    card.toggleAttribute("data-editing", editingId === id);
    const content = textElement("div", "", "doc-annotation-note-content");
    const reference = textElement("div", "", "doc-annotation-reference");
    const kind = textElement("span", "", "doc-annotation-kind");
    kind.setAttribute(
      "aria-label",
      anchor.kind === "text"
        ? view.labels.textSelection
        : view.labels.figureKind
    );
    kind.append(annotationIcon(view, anchor.kind));
    const statusBadge = textElement(
      "span",
      status === "open" ? view.labels.openStatus : view.labels.resolvedStatus,
      "doc-annotation-status"
    );
    statusBadge.dataset.status = status;
    card.append(
      textElement(
        "span",
        String(index + 1).padStart(2, "0"),
        "doc-annotation-number"
      )
    );
    const go = actionButton(view, "go", view.labels.showTarget, id);
    go.disabled = detached.has(id);
    reference.append(
      kind,
      statusBadge,
      textElement("blockquote", anchor.quote),
      go
    );
    content.append(reference);
    if (detached.has(id)) {
      const warning = textElement("div", "", "doc-annotation-detached");
      warning.append(
        annotationIcon(view, "warning"),
        textElement("span", view.labels.targetUnavailable)
      );
      warning.title = view.labels.targetUnavailableTitle;
      content.append(warning);
    }
    content.append(textElement("p", comment, "doc-annotation-comment-body"));
    if (status === "resolved" && resolution !== undefined) {
      content.append(resolutionDetails(view, resolution));
    }
    const footer = textElement("div", "", "doc-annotation-card-footer");
    const location =
      anchor.source === undefined
        ? anchor.heading
        : annotationLocation(anchor.source);
    if (location !== "") {
      const source = textElement("span", "", "doc-annotation-location");
      source.title = location;
      source.setAttribute("aria-label", view.labels.sourceLabel(location));
      source.append(
        textElement(
          "span",
          anchor.source === undefined ? location : filename(location)
        )
      );
      footer.append(source);
    }
    const actions = textElement("div", "", "doc-annotation-actions");
    const statusAction = status === "open" ? "resolve" : "reopen";
    const statusButton = actionButton(
      view,
      statusAction,
      status === "open" ? view.labels.resolve : view.labels.reopen,
      id
    );
    statusButton.disabled = resolving;
    if (resolving) {
      statusButton.setAttribute("aria-label", view.labels.resolving);
      statusButton.title = view.labels.resolving;
    }
    const editButton = actionButton(view, "edit", view.labels.edit, id);
    editButton.disabled = resolving;
    actions.append(
      editButton,
      statusButton,
      actionButton(view, "delete", view.labels.delete, id)
    );
    footer.append(actions);
    content.append(footer);
    card.append(content);
    return card;
  });
  view.list.replaceChildren(...cards);
  const openCount = annotations.filter(
    (annotation) => annotationStatus(annotation) === "open"
  ).length;
  view.count.textContent = String(openCount);
  view.count.hidden = openCount === 0;
  view.panelCount.textContent = String(annotations.length);
  view.filter.value = filter;
  let emptyMessage = view.labels.noComments;
  if (annotations.length > 0 && filter === "open") {
    emptyMessage = view.labels.noOpenComments;
  } else if (annotations.length > 0 && filter === "resolved") {
    emptyMessage = view.labels.noResolvedComments;
  }
  view.empty.textContent = emptyMessage;
  const busy =
    view.copy.dataset.busy === "true" || view.send.dataset.busy === "true";
  view.copy.disabled = openCount === 0 || busy;
  view.send.disabled = openCount === 0 || busy;
  view.empty.hidden =
    visibleAnnotations.length > 0 || view.form.hidden !== true;
};

const formatBatchDate = (createdAt: string, locale: string): string => {
  const timestamp = Date.parse(createdAt);
  return Number.isNaN(timestamp)
    ? createdAt
    : new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(timestamp);
};

const historyLocation = (annotation: DocumentAnnotation): string =>
  annotation.anchor.source === undefined
    ? annotation.anchor.heading
    : annotationLocation(annotation.anchor.source);

const historySignature = (history: readonly AnnotationBatch[]): string =>
  JSON.stringify(
    history.map((batch) => [
      batch.id,
      batch.createdAt,
      batch.action,
      batch.annotations.map((annotation) => [
        annotation.id,
        annotation.anchor.quote,
        annotation.comment,
        annotationStatus(annotation),
        annotation.resolution,
        historyLocation(annotation),
      ]),
    ])
  );

export const renderAnnotationHistory = (
  view: AnnotationView,
  history: readonly AnnotationBatch[]
): void => {
  const batches = history.toReversed();
  const signature = historySignature(batches);
  view.historyCount.textContent = String(history.length);
  view.history.hidden = history.length === 0;
  if (view.list.childElementCount === 0 && view.filter.value === "all") {
    view.empty.textContent =
      history.length > 0
        ? view.labels.noCurrentComments
        : view.labels.noComments;
  }
  if (annotationHistorySignatures.get(view.historyList) === signature) {
    return;
  }

  const openBatchIds = new Set(
    [
      ...view.historyList.querySelectorAll<HTMLDetailsElement>(
        "details[data-annotation-batch]"
      ),
    ]
      .filter((batch) => batch.open)
      .map((batch) => batch.dataset.annotationBatch)
      .filter((id): id is string => id !== undefined)
  );
  const { activeElement } = document;
  const focusedBatchId =
    activeElement instanceof HTMLElement &&
    view.historyList.contains(activeElement)
      ? activeElement.closest<HTMLDetailsElement>(
          "details[data-annotation-batch]"
        )?.dataset.annotationBatch
      : undefined;
  const batchElements = batches.map((batch) => {
    const details = document.createElement("details");
    details.className = "doc-annotation-history-batch";
    details.dataset.annotationBatch = batch.id;
    details.open = openBatchIds.has(batch.id);

    const summary = textElement(
      "summary",
      "",
      "doc-annotation-history-summary"
    );
    const date = textElement(
      "time",
      formatBatchDate(batch.createdAt, view.labels.dateLocale)
    );
    date.dateTime = batch.createdAt;
    const action = textElement(
      "span",
      batch.action === "copy"
        ? view.labels.historyActionCopy
        : view.labels.historyActionSend,
      "doc-annotation-history-action"
    );
    const count = textElement(
      "span",
      view.labels.commentCount(batch.annotations.length),
      "doc-annotation-history-batch-count"
    );
    summary.append(date, action, count);

    const entries = batch.annotations.map((annotation) => {
      const entry = textElement("article", "", "doc-annotation-history-entry");
      const { quote } = annotation.anchor;
      if (quote !== "") {
        entry.append(
          textElement("blockquote", quote, "doc-annotation-history-quote")
        );
      }
      entry.append(
        textElement("p", annotation.comment, "doc-annotation-history-comment")
      );
      const location = historyLocation(annotation);
      if (location !== "") {
        const source = textElement(
          "p",
          location,
          "doc-annotation-history-location"
        );
        source.title = location;
        entry.append(source);
      }
      return entry;
    });

    const content = textElement("div", "", "doc-annotation-history-content");
    content.append(...entries);
    details.append(summary, content);
    return details;
  });

  view.historyList.replaceChildren(...batchElements);
  annotationHistorySignatures.set(view.historyList, signature);
  if (focusedBatchId !== undefined) {
    const focusedBatch = [
      ...view.historyList.querySelectorAll<HTMLDetailsElement>(
        "details[data-annotation-batch]"
      ),
    ].find((batch) => batch.dataset.annotationBatch === focusedBatchId);
    focusedBatch?.querySelector("summary")?.focus({ preventScroll: true });
  }
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
      "doc-annotations",
      new Highlight(
        ...targets.flatMap(({ range }) => (range === undefined ? [] : [range]))
      )
    );
    CSS.highlights.set(
      "doc-annotation-active",
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
    box.className = "doc-annotation-outline";
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

import {
  annotationStatus,
  annotationsMarkdown,
  findAnnotationSource,
  parseAnnotationDocument,
  parseAnnotationStore,
} from "../annotations.js";
import type {
  AnnotationAnchor,
  AnnotationBatch,
  AnnotationDocument,
  AnnotationStatus,
  DocumentAnnotation,
} from "../annotations.js";
import { REVIEW_IMPORT_EVENT } from "../review-transfer.js";
import {
  annotationFigures,
  captureFigureAnchor,
  captureTextAnchor,
  figureLabel,
  resolveAnnotation,
  targetRect,
} from "./annotation-anchors.js";
import type { ResolvedAnnotation } from "./annotation-anchors.js";
import { resolveAnnotationVersion } from "./annotation-resolution.js";
import {
  annotationView,
  paintAnnotationTargets,
  positionSelectionButton,
  renderAnnotationHistory,
  renderAnnotationList,
} from "./annotation-view.js";
import type { AnnotationView } from "./annotation-view.js";
import { writeClipboard } from "./doc-events.js";
import { documentStorageKey } from "./document-identity.js";
import { WORKSPACE_EXPORT_STATE_EVENT } from "./workspace-export-state.js";

interface Draft {
  anchor: AnnotationAnchor;
  id?: string;
  originalComment?: string;
}

const annotationId = (): string =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Owns only the review chrome; the MDX/React tree is never rewritten. */
class AnnotationController {
  private readonly root: HTMLElement;
  private readonly host: HTMLElement;
  private readonly info: AnnotationDocument;
  private readonly view: AnnotationView;
  private readonly storageKey: string;
  private annotations: DocumentAnnotation[] = [];
  private history: AnnotationBatch[] = [];
  private filter: "all" | AnnotationStatus = "all";
  private readonly resolving = new Set<string>();
  private readonly targets = new Map<string, ResolvedAnnotation>();
  private readonly detached = new Set<string>();
  private draft?: Draft;
  private selection?: ReturnType<typeof captureTextAnchor>;
  private active?: ResolvedAnnotation;
  private figures: Element[] = [];
  private picking = false;
  private selecting = false;
  private frame = 0;
  private needsResolve = false;
  private copyTimer?: ReturnType<typeof setTimeout>;

  constructor(root: HTMLElement, host: HTMLElement, info: AnnotationDocument) {
    this.root = root;
    this.host = host;
    this.info = info;
    this.view = annotationView(host, info.file, info.revision);
    const revealSendButton = (): boolean => {
      if (document.querySelector("[data-mdxr-agent]") === null) {
        return false;
      }
      this.view.send.hidden = false;
      return true;
    };
    if (!revealSendButton()) {
      const observer = new MutationObserver(() => {
        if (revealSendButton()) {
          observer.disconnect();
        }
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          if (revealSendButton()) {
            observer.disconnect();
          }
        },
        { once: true }
      );
    }
    this.storageKey = documentStorageKey("mdxr:annotations:v1:", info);
    this.load();
    this.bindEvents();
    document.addEventListener(REVIEW_IMPORT_EVENT, (event) => {
      this.annotations = structuredClone(event.detail.annotations.annotations);
      this.history = structuredClone(event.detail.annotations.history);
      if (!this.persist()) {
        event.detail.errors.push("Comments could not be saved");
      }
    });
    this.refresh();
    // Re-resolve after hydration, Mermaid, tab changes, or other DOM updates.
    new MutationObserver(() => {
      this.schedule(true);
    }).observe(root, { characterData: true, childList: true, subtree: true });
    new ResizeObserver(() => {
      this.schedule();
    }).observe(root);
  }

  private status(
    message: string,
    state: "info" | "saved" | "success" | "warning" = "info"
  ): void {
    this.view.status.textContent = message;
    this.view.statusRow.dataset.state = state;
  }

  private load(): void {
    try {
      const saved = parseAnnotationStore(localStorage.getItem(this.storageKey));
      this.annotations = saved.annotations;
      this.history = saved.history;
    } catch {
      this.status(this.view.labels.loadError, "warning");
    }
  }

  private persist(): boolean {
    let saved = false;
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({
          annotations: this.annotations,
          history: this.history,
          version: 2,
        })
      );
      saved = true;
      this.status(this.view.labels.saved, "saved");
    } catch {
      this.status(this.view.labels.storageUnavailable, "warning");
    }
    this.view.export.hidden = true;
    this.resetCopyFeedback();
    this.refresh();
    return saved;
  }

  private refresh(): void {
    this.targets.clear();
    this.detached.clear();
    for (const annotation of this.annotations) {
      const target = resolveAnnotation(
        this.root,
        annotation.anchor,
        this.info.revision
      );
      if (target === undefined) {
        this.detached.add(annotation.id);
      } else {
        this.targets.set(annotation.id, target);
        // Source line numbers may shift after a serve rebuild.
        annotation.anchor.source = findAnnotationSource(
          annotation.anchor,
          this.info.sources
        );
      }
    }
    if (this.draft !== undefined) {
      this.active = resolveAnnotation(
        this.root,
        this.draft.anchor,
        this.info.revision
      );
    }
    renderAnnotationList(
      this.view,
      this.annotations,
      this.detached,
      this.draft?.id,
      this.filter,
      this.resolving
    );
    renderAnnotationHistory(this.view, this.history);
    this.paint();
  }

  private paint(): void {
    const visibleTargets = this.annotations
      .filter(
        (annotation) =>
          annotationStatus(annotation) === "open" && this.filter !== "resolved"
      )
      .flatMap((annotation) => {
        const target = this.targets.get(annotation.id);
        return target === undefined ? [] : [target];
      });
    paintAnnotationTargets(this.view, visibleTargets, this.active);
    if (
      this.selection !== undefined &&
      this.draft === undefined &&
      !this.selecting &&
      !this.picking
    ) {
      positionSelectionButton(this.view, this.selection.target);
    }
  }

  private schedule(resolve = false): void {
    this.needsResolve ||= resolve;
    if (this.frame !== 0) {
      return;
    }
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.needsResolve) {
        this.needsResolve = false;
        this.refresh();
      } else {
        this.paint();
      }
    });
  }

  private open(open: boolean): void {
    this.view.panel.hidden = !open;
    this.view.toggle.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("mdxr-annotations-open", open);
    if (!open) {
      this.pick(false);
      this.view.toggle.focus({ preventScroll: true });
    } else if (this.draft !== undefined) {
      this.active = resolveAnnotation(
        this.root,
        this.draft.anchor,
        this.info.revision
      );
    }
    this.schedule();
  }

  private captureSelection(): void {
    if (this.selecting || this.host.contains(document.activeElement)) {
      return;
    }
    this.selection = captureTextAnchor(this.root);
    this.view.selection.hidden =
      this.selection === undefined || this.draft !== undefined;
    if (!this.view.selection.hidden) {
      this.schedule();
    }
  }

  private begin(
    anchor: AnnotationAnchor,
    target?: ResolvedAnnotation,
    annotation?: DocumentAnnotation
  ): void {
    if (this.draft !== undefined && this.view.comment.value.trim() !== "") {
      this.open(true);
      this.status(this.view.labels.finishCurrentComment, "warning");
      this.view.comment.focus({ preventScroll: true });
      return;
    }
    if (annotation === undefined) {
      anchor.revision = this.info.revision;
      anchor.source = findAnnotationSource(anchor, this.info.sources);
    }
    this.draft = {
      anchor,
      id: annotation?.id,
      originalComment: annotation?.comment,
    };
    this.resetCopyFeedback();
    this.pick(false);
    this.active = target;
    this.selection = undefined;
    this.view.selection.hidden = true;
    this.view.form.hidden = false;
    this.view.form.dataset.kind = anchor.kind;
    this.view.empty.hidden = true;
    this.view.form.setAttribute(
      "aria-label",
      annotation === undefined
        ? this.view.labels.newComment
        : this.view.labels.editComment
    );
    this.view.draftQuote.textContent = anchor.quote;
    this.view.comment.value = annotation?.comment ?? "";
    const saveLabel =
      annotation === undefined
        ? this.view.labels.saveComment
        : this.view.labels.saveChanges;
    this.view.save.setAttribute("aria-label", saveLabel);
    this.view.save.title = this.view.labels.saveTitle(saveLabel);
    this.open(true);
    window.getSelection()?.removeAllRanges();
    this.view.form.scrollIntoView({ block: "nearest" });
    this.view.comment.focus({ preventScroll: true });
    renderAnnotationList(
      this.view,
      this.annotations,
      this.detached,
      this.draft.id,
      this.filter,
      this.resolving
    );
    if (target !== undefined) {
      this.showTarget(target);
    }
  }

  private cancel(): void {
    this.draft = undefined;
    this.active = undefined;
    this.view.comment.value = "";
    this.view.form.hidden = true;
    this.view.toggle.focus({ preventScroll: true });
    this.refresh();
  }

  private save(event: Event): void {
    event.preventDefault();
    const comment = this.view.comment.value.trim();
    if (this.draft === undefined || comment === "") {
      this.view.form.reportValidity();
      this.view.comment.focus();
      return;
    }
    const existing = this.annotations.find(({ id }) => id === this.draft?.id);
    if (
      this.draft.id !== undefined &&
      existing?.comment !== this.draft.originalComment
    ) {
      this.status(this.view.labels.editConflict, "warning");
      this.view.comment.focus({ preventScroll: true });
      return;
    }
    if (existing === undefined) {
      const id = annotationId();
      this.annotations.push({
        anchor: this.draft.anchor,
        comment,
        id,
        status: "open",
      });
    } else {
      if (existing.comment !== comment) {
        existing.status = "open";
        delete existing.resolution;
      }
      existing.comment = comment;
    }
    if (
      this.filter === "resolved" &&
      (existing === undefined || annotationStatus(existing) === "open")
    ) {
      this.filter = "open";
      this.view.filter.value = this.filter;
    }
    this.cancel();
    this.persist();
  }

  private pick(enabled: boolean): void {
    this.picking = enabled;
    this.view.pick.setAttribute("aria-pressed", String(enabled));
    this.view.figurePicker.hidden = !enabled;
    if (!enabled) {
      this.active = undefined;
      this.schedule();
      return;
    }
    this.selection = undefined;
    this.view.selection.hidden = true;
    window.getSelection()?.removeAllRanges();
    this.figures = annotationFigures(this.root);
    this.view.figure.replaceChildren(
      ...this.figures.map((element, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = `${index + 1}. ${figureLabel(element)}`;
        return option;
      })
    );
    this.view.useFigure.disabled = this.figures.length === 0;
    if (this.figures.length === 0) {
      this.status(this.view.labels.noFiguresFound, "warning");
    }
    this.view.figure.focus();
  }

  private beginFigure(element: Element | undefined): void {
    if (element !== undefined) {
      this.begin(captureFigureAnchor(this.root, element), { element });
    }
  }

  private showTarget(target: ResolvedAnnotation): void {
    target.element.dispatchEvent(new Event("mdxr:reveal", { bubbles: true }));
    for (
      let parent: Element | null = target.element;
      parent !== null && parent !== this.root;
      parent = parent.parentElement
    ) {
      if (parent instanceof HTMLDetailsElement) {
        parent.open = true;
      }
    }
    const rect = targetRect(target);
    const available =
      this.view.panel.hidden === true || window.innerWidth >= 1000
        ? window.innerHeight
        : this.view.panel.getBoundingClientRect().top;
    window.scrollTo({
      behavior: "instant",
      top: Math.max(
        0,
        window.scrollY +
          rect.top -
          Math.max(64, (available - Math.min(rect.height, available / 2)) / 2)
      ),
    });
    this.schedule();
  }

  private cardAction(button: HTMLElement): void {
    const annotation = this.annotations.find(
      ({ id }) => id === button.dataset.annotationId
    );
    if (annotation === undefined) {
      return;
    }
    const target = this.targets.get(annotation.id);
    switch (button.dataset.annotationAction ?? "") {
      case "go": {
        this.active = target;
        if (target !== undefined) {
          this.showTarget(target);
        }
        break;
      }
      case "edit": {
        if (this.resolving.has(annotation.id)) {
          return;
        }
        this.begin(annotation.anchor, target, annotation);
        break;
      }
      case "resolve": {
        void this.resolve(annotation);
        break;
      }
      case "reopen": {
        annotation.status = "open";
        delete annotation.resolution;
        const saved = this.persist();
        if (saved) {
          this.status(this.view.labels.reopenedSaved, "success");
        }
        this.focusCardAction(annotation.id, "resolve");
        break;
      }
      case "delete": {
        this.annotations = this.annotations.filter(
          ({ id }) => id !== annotation.id
        );
        if (this.draft?.id === annotation.id) {
          this.cancel();
        }
        this.persist();
        this.view.toggle.focus({ preventScroll: true });
        break;
      }
      default: {
        break;
      }
    }
  }

  private focusCardAction(id: string, action: string): void {
    const button = [
      ...this.view.list.querySelectorAll<HTMLButtonElement>(
        "button[data-annotation-action]"
      ),
    ].find(
      (candidate) =>
        candidate.dataset.annotationId === id &&
        candidate.dataset.annotationAction === action
    );
    (button ?? this.view.filter).focus({ preventScroll: true });
  }

  private finishResolution(id: string): void {
    this.resolving.delete(id);
    const focused = document.activeElement;
    const restoreFocus =
      focused === document.body ||
      (focused instanceof HTMLElement && focused.dataset.annotationId === id);
    this.refresh();
    if (restoreFocus) {
      const current = this.annotations.find(
        (annotation) => annotation.id === id
      );
      this.focusCardAction(
        id,
        current !== undefined && annotationStatus(current) === "resolved"
          ? "reopen"
          : "resolve"
      );
    }
  }

  private async resolve(annotation: DocumentAnnotation): Promise<void> {
    if (
      annotationStatus(annotation) === "resolved" ||
      this.resolving.has(annotation.id)
    ) {
      return;
    }
    if (this.draft?.id === annotation.id) {
      this.status(this.view.labels.finishCurrentComment, "warning");
      this.view.comment.focus({ preventScroll: true });
      return;
    }
    this.resolving.add(annotation.id);
    this.refresh();
    const snapshot = JSON.stringify({
      anchor: annotation.anchor,
      comment: annotation.comment,
    });
    this.status(this.view.labels.resolving);
    try {
      const resolution = await resolveAnnotationVersion(this.info);
      const current = this.annotations.find(({ id }) => id === annotation.id);
      if (current === undefined || annotationStatus(current) === "resolved") {
        this.status(this.view.labels.changedWhileResolving, "warning");
        return;
      }
      if (
        JSON.stringify({ anchor: current.anchor, comment: current.comment }) !==
        snapshot
      ) {
        this.status(this.view.labels.changedWhileResolving, "warning");
        return;
      }
      current.status = "resolved";
      current.resolution = resolution;
      this.active = undefined;
      const saved = this.persist();
      if (saved) {
        this.status(this.view.labels.resolvedSaved, "success");
      }
    } catch {
      this.status(this.view.labels.resolutionError, "warning");
    } finally {
      this.finishResolution(annotation.id);
    }
  }

  private resetCopyFeedback(): void {
    clearTimeout(this.copyTimer);
    delete this.view.copy.dataset.state;
    this.view.copyLabel.textContent = this.view.labels.copyMarkdown;
  }

  private handoff(
    action: AnnotationBatch["action"]
  ): AnnotationBatch | undefined {
    if (
      this.annotations.length === 0 ||
      this.view.copy.dataset.busy === "true" ||
      this.view.send.dataset.busy === "true"
    ) {
      return undefined;
    }
    this.refresh();
    const annotations = structuredClone(
      this.annotations.filter(
        (annotation) => annotationStatus(annotation) === "open"
      )
    );
    if (annotations.length === 0) {
      return undefined;
    }
    return {
      action,
      annotations,
      createdAt: new Date().toISOString(),
      id: annotationId(),
      markdown: annotationsMarkdown(this.info, annotations, this.detached),
    };
  }

  private archive(batch: AnnotationBatch): boolean {
    // Handoffs are immutable snapshots; the review keeps its comment IDs and state.
    this.history.push({ ...batch, createdAt: new Date().toISOString() });
    this.selection = undefined;
    this.view.selection.hidden = true;
    this.pick(false);
    window.getSelection()?.removeAllRanges();
    return this.persist();
  }

  private copy(): void {
    const batch = this.handoff("copy");
    if (batch === undefined) {
      return;
    }
    this.resetCopyFeedback();
    this.view.copy.dataset.busy = "true";
    this.refresh();
    const { markdown } = batch;
    this.view.markdown.value = markdown;
    writeClipboard(
      markdown,
      () => {
        delete this.view.copy.dataset.busy;
        const saved = this.archive(batch);
        this.view.export.hidden = true;
        this.view.copy.dataset.state = "copied";
        this.view.copyLabel.textContent = this.view.labels.copyCopied;
        this.copyTimer = setTimeout(() => {
          this.resetCopyFeedback();
        }, 2400);
        this.status(
          saved
            ? this.view.labels.copiedToHistory
            : this.view.labels.copiedToHistoryStorageUnavailable,
          saved ? "success" : "warning"
        );
      },
      () => {
        delete this.view.copy.dataset.busy;
        this.refresh();
        this.view.export.hidden = false;
        this.view.markdown.focus();
        this.view.markdown.select();
        this.status(this.view.labels.clipboardFailure, "warning");
      }
    );
  }

  private async send(): Promise<void> {
    const batch = this.handoff("send");
    if (batch === undefined) {
      return;
    }
    this.view.send.dataset.busy = "true";
    this.refresh();
    this.status(this.view.labels.sending, "info");
    try {
      const response = await fetch("/__mdxr_agent", {
        body: JSON.stringify({ message: batch.markdown }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        let result: unknown;
        try {
          result = await response.json();
        } catch {
          result = undefined;
        }
        const error =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "";
        this.status(
          error === ""
            ? this.view.labels.sendFallbackFailed
            : this.view.labels.sendFailed(error),
          "warning"
        );
        return;
      }
      const saved = this.archive(batch);
      this.status(
        saved
          ? this.view.labels.sentToHistory
          : this.view.labels.sentToHistoryStorageUnavailable,
        saved ? "success" : "warning"
      );
    } catch (error) {
      this.status(
        error instanceof Error && error.message !== ""
          ? this.view.labels.sendFailed(error.message)
          : this.view.labels.sendFallbackFailed,
        "warning"
      );
    } finally {
      delete this.view.send.dataset.busy;
      this.refresh();
    }
  }

  private keydown(event: KeyboardEvent): void {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      event.key.toLowerCase() === "m"
    ) {
      const selection = captureTextAnchor(this.root);
      if (selection !== undefined) {
        event.preventDefault();
        this.begin(selection.anchor, selection.target);
      }
    }
    if (
      event.key === "Escape" &&
      (this.host.contains(document.activeElement) ||
        this.picking ||
        this.view.selection.hidden !== true)
    ) {
      this.selection = undefined;
      this.view.selection.hidden = true;
      this.open(false);
    }
  }

  private bindEvents(): void {
    const { view } = this;
    view.toggle.addEventListener("click", () => {
      this.open(view.panel.hidden === true);
      if (view.panel.hidden !== true) {
        view.pick.focus();
      }
    });
    this.host
      .querySelector("[data-annotation-close]")
      ?.addEventListener("click", () => {
        this.open(false);
      });
    this.host
      .querySelector("[data-annotation-cancel]")
      ?.addEventListener("click", () => {
        this.cancel();
      });
    view.selection.addEventListener("pointerdown", (event) => {
      event.preventDefault();
    });
    view.selection.addEventListener("click", () => {
      if (this.selection !== undefined) {
        this.begin(this.selection.anchor, this.selection.target);
      }
    });
    view.form.addEventListener("submit", (event) => {
      this.save(event);
    });
    // Local saves must also work in previews that sandbox native form submission.
    view.save.addEventListener("click", (event) => {
      this.save(event);
    });
    view.comment.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        this.save(event);
      }
    });
    view.pick.addEventListener("click", () => {
      this.pick(!this.picking);
    });
    view.useFigure.addEventListener("click", () => {
      this.beginFigure(this.figures[Number(view.figure.value)]);
    });
    view.figure.addEventListener("change", () => {
      const element = this.figures[Number(view.figure.value)];
      if (element !== undefined) {
        this.active = { element };
        this.showTarget(this.active);
      }
    });
    view.filter.addEventListener("change", () => {
      const { value } = view.filter;
      if (value === "all" || value === "open" || value === "resolved") {
        this.filter = value;
        this.active = undefined;
        this.refresh();
      }
    });
    view.copy.addEventListener("click", () => {
      this.copy();
    });
    view.send.addEventListener("click", () => {
      void this.send();
    });
    view.list.addEventListener("click", (event) => {
      const button =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-annotation-action]")
          : null;
      if (button !== null) {
        this.cardAction(button);
      }
    });
    this.bindDocumentEvents();
  }

  private bindDocumentEvents(): void {
    this.root.addEventListener("pointerdown", () => {
      this.selecting = true;
      this.view.selection.hidden = true;
    });
    document.addEventListener("pointerup", () => {
      this.selecting = false;
      this.captureSelection();
    });
    document.addEventListener("selectionchange", () => {
      this.captureSelection();
    });
    document.addEventListener("keydown", (event) => {
      this.keydown(event);
    });
    this.root.addEventListener(
      "click",
      (event) => {
        if (!this.picking || !(event.target instanceof Element)) {
          return;
        }
        const hit = event.target;
        const figure = annotationFigures(this.root).find((element) =>
          element.contains(hit)
        );
        if (figure !== undefined) {
          event.preventDefault();
          event.stopPropagation();
          this.beginFigure(figure);
        }
      },
      true
    );
    this.root.addEventListener("pointermove", (event) => {
      if (!this.picking || !(event.target instanceof Element)) {
        return;
      }
      const hit = event.target;
      const element = this.figures.find((figure) => figure.contains(hit));
      this.active = element === undefined ? undefined : { element };
      this.schedule();
    });
    document.addEventListener(
      "scroll",
      () => {
        this.schedule();
      },
      { capture: true, passive: true }
    );
    window.addEventListener("resize", () => {
      this.schedule();
    });
    document.addEventListener("mdxr:pagechange", () => {
      this.schedule();
    });
    window.addEventListener("storage", (event) => {
      if (event.key === this.storageKey || event.key === null) {
        this.load();
        this.refresh();
      }
    });
    document.addEventListener(WORKSPACE_EXPORT_STATE_EVENT, (event) => {
      const state = event.detail;
      this.refresh();
      state.annotations = structuredClone({
        annotations: this.annotations,
        history: this.history,
      });
      state.detachedAnnotationIds = [...this.detached];
      if (this.draft === undefined) {
        delete state.annotationDraft;
      } else {
        state.annotationDraft = {
          anchor: structuredClone(this.draft.anchor),
          ...(this.draft.id === undefined ? {} : { id: this.draft.id }),
          comment: this.view.comment.value,
        };
      }
    });
  }
}

export const initAnnotations = (): AnnotationController | undefined => {
  const root = document.querySelector<HTMLElement>("#mdxr-root");
  const host = document.querySelector<HTMLElement>("#mdxr-annotations");
  const data = document.querySelector("#mdxr-annotation-document");
  if (root === null || host === null || data === null) {
    return undefined;
  }
  const info = parseAnnotationDocument(data.textContent ?? "{}");
  if (info !== undefined) {
    return new AnnotationController(root, host, info);
  }
  return undefined;
};

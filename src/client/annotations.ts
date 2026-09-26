import {
  annotationsMarkdown,
  findAnnotationSource,
  parseAnnotationDocument,
  parseAnnotations,
} from "../annotations.js";
import type {
  AnnotationAnchor,
  AnnotationDocument,
  DocumentAnnotation,
} from "../annotations.js";
import {
  annotationFigures,
  captureFigureAnchor,
  captureTextAnchor,
  figureLabel,
  resolveAnnotation,
  targetRect,
} from "./annotation-anchors.js";
import type { ResolvedAnnotation } from "./annotation-anchors.js";
import {
  annotationView,
  paintAnnotationTargets,
  positionSelectionButton,
  renderAnnotationList,
} from "./annotation-view.js";
import type { AnnotationView } from "./annotation-view.js";
import { writeClipboard } from "./doc-events.js";

interface Draft {
  anchor: AnnotationAnchor;
  id?: string;
}

/** Owns only the review chrome; the MDX/React tree is never rewritten. */
class AnnotationController {
  private readonly root: HTMLElement;
  private readonly host: HTMLElement;
  private readonly info: AnnotationDocument;
  private readonly view: AnnotationView;
  private readonly storageKey: string;
  private annotations: DocumentAnnotation[] = [];
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
    this.view = annotationView(host, info.file);
    this.storageKey = `mdxr:annotations:v1:${info.file}`;
    this.load();
    this.bindEvents();
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
      this.annotations = parseAnnotations(
        localStorage.getItem(this.storageKey)
      );
    } catch {
      this.status(
        "Saved annotations could not be loaded. New comments can still be copied as Markdown.",
        "warning"
      );
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({ annotations: this.annotations, version: 1 })
      );
      this.status("Saved in this browser", "saved");
    } catch {
      this.status(
        "Browser storage is unavailable. Copy Markdown before closing this page to keep your comments.",
        "warning"
      );
    }
    this.view.export.hidden = true;
    this.resetCopyFeedback();
    this.refresh();
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
      this.draft?.id
    );
    this.paint();
  }

  private paint(): void {
    paintAnnotationTargets(this.view, [...this.targets.values()], this.active);
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
      this.status("Finish the current comment first.", "warning");
      this.view.comment.focus({ preventScroll: true });
      return;
    }
    if (annotation === undefined) {
      anchor.revision = this.info.revision;
      anchor.source = findAnnotationSource(anchor, this.info.sources);
    }
    this.draft = { anchor, id: annotation?.id };
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
      annotation === undefined ? "New comment" : "Edit comment"
    );
    this.view.draftQuote.textContent = anchor.quote;
    this.view.comment.value = annotation?.comment ?? "";
    const saveLabel =
      annotation === undefined ? "Save comment" : "Save changes";
    this.view.save.setAttribute("aria-label", saveLabel);
    this.view.save.title = `${saveLabel} (Ctrl / ⌘ + Enter)`;
    this.open(true);
    window.getSelection()?.removeAllRanges();
    this.view.form.scrollIntoView({ block: "nearest" });
    this.view.comment.focus({ preventScroll: true });
    renderAnnotationList(
      this.view,
      this.annotations,
      this.detached,
      this.draft.id
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
    if (existing === undefined) {
      const id =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      this.annotations.push({ anchor: this.draft.anchor, comment, id });
    } else {
      existing.comment = comment;
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
      this.status("No figures found.", "warning");
    }
    this.view.figure.focus();
  }

  private beginFigure(element: Element | undefined): void {
    if (element !== undefined) {
      this.begin(captureFigureAnchor(this.root, element), { element });
    }
  }

  private showTarget(target: ResolvedAnnotation): void {
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
        this.begin(annotation.anchor, target, annotation);
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

  private resetCopyFeedback(): void {
    clearTimeout(this.copyTimer);
    delete this.view.copy.dataset.state;
    this.view.copyLabel.textContent = "Markdown";
  }

  private copy(): void {
    this.resetCopyFeedback();
    this.refresh();
    const markdown = annotationsMarkdown(
      this.info,
      this.annotations,
      this.detached
    );
    this.view.markdown.value = markdown;
    writeClipboard(
      markdown,
      () => {
        this.view.export.hidden = true;
        this.view.copy.dataset.state = "copied";
        this.view.copyLabel.textContent = "Copied";
        this.copyTimer = setTimeout(() => {
          this.resetCopyFeedback();
        }, 2400);
        this.status(
          "Markdown copied. Paste it into your coding agent.",
          "success"
        );
      },
      () => {
        this.view.export.hidden = false;
        this.view.markdown.focus();
        this.view.markdown.select();
        this.status(
          "Clipboard access failed. Copy the selected Markdown below.",
          "warning"
        );
      }
    );
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
    view.copy.addEventListener("click", () => {
      this.copy();
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
    window.addEventListener("storage", (event) => {
      if (event.key === this.storageKey) {
        this.load();
        this.refresh();
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

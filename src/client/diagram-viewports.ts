const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const ZOOM_STEP = 1.25;
const PAN_STEP = 40;
const DRAG_THRESHOLD = 4;

interface Point {
  x: number;
  y: number;
}

interface Pointer extends Point {
  start: Point;
}

const center = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

const distance = (a: Point, b: Point): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

const eventPoint = (event: MouseEvent): Point => ({
  x: event.clientX,
  y: event.clientY,
});

/** State is created on interaction, leaving the server DOM intact for hydration. */
class DiagramView {
  readonly canvas: HTMLElement;
  readonly root: HTMLElement;
  readonly pointers = new Map<number, Pointer>();
  private scale = 1;
  private x = 0;
  private y = 0;
  private dragged = false;
  private suppressClickUntil = 0;

  constructor(root: HTMLElement, canvas: HTMLElement) {
    this.root = root;
    this.canvas = canvas;
  }

  private paint(): void {
    this.canvas.style.setProperty(
      "--mdxr-diagram-transform",
      `translate(${this.x}px, ${this.y}px) scale(${this.scale})`
    );
    const output = this.root.querySelector("[data-diagram-scale]");
    const percent = `${Math.round(this.scale * 100)}%`;
    if (output !== null && output.textContent !== percent) {
      output.textContent = percent;
    }
    const zoomOut = this.root.querySelector<HTMLButtonElement>(
      '[data-diagram-action="out"]'
    );
    const zoomIn = this.root.querySelector<HTMLButtonElement>(
      '[data-diagram-action="in"]'
    );
    if (zoomOut !== null) {
      zoomOut.disabled = this.scale <= MIN_SCALE;
    }
    if (zoomIn !== null) {
      zoomIn.disabled = this.scale >= MAX_SCALE;
    }
  }

  zoom(factor: number, at?: Point): void {
    const image = this.canvas.querySelector("svg");
    if (image === null) {
      return;
    }
    const bounds = image.getBoundingClientRect();
    const viewport = this.canvas.getBoundingClientRect();
    const anchor = at ?? {
      x: viewport.left + viewport.width / 2,
      y: viewport.top + viewport.height / 2,
    };
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.scale * factor));
    const ratio = next / this.scale;
    this.x += (anchor.x - bounds.left) * (1 - ratio);
    this.y += (anchor.y - bounds.top) * (1 - ratio);
    this.scale = next;
    this.paint();
  }

  pan(x: number, y: number): void {
    this.x += x;
    this.y += y;
    this.paint();
  }

  reset(): void {
    this.scale = 1;
    this.x = 0;
    this.y = 0;
    this.canvas.scrollTo(0, 0);
    this.paint();
  }

  action(action: string | undefined): void {
    switch (action ?? "") {
      case "in": {
        this.zoom(ZOOM_STEP);
        break;
      }
      case "out": {
        this.zoom(1 / ZOOM_STEP);
        break;
      }
      case "reset": {
        this.reset();
        break;
      }
      default: {
        break;
      }
    }
  }

  key(event: KeyboardEvent): void {
    if (
      event.target !== this.canvas ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }
    const arrows: Record<string, Point> = {
      ArrowDown: { x: 0, y: -PAN_STEP },
      ArrowLeft: { x: PAN_STEP, y: 0 },
      ArrowRight: { x: -PAN_STEP, y: 0 },
      ArrowUp: { x: 0, y: PAN_STEP },
    };
    const movement = arrows[event.key];
    if (movement !== undefined) {
      this.pan(movement.x, movement.y);
    } else if (event.key === "+" || event.key === "=") {
      this.zoom(ZOOM_STEP);
    } else if (event.key === "-" || event.key === "−") {
      this.zoom(1 / ZOOM_STEP);
    } else if (event.key === "0" || event.key === "Home") {
      this.reset();
    } else {
      return;
    }
    event.preventDefault();
  }

  start(event: PointerEvent): void {
    if (this.pointers.size >= 2) {
      return;
    }
    const point = eventPoint(event);
    this.pointers.set(event.pointerId, { ...point, start: point });
    if (this.pointers.size === 1) {
      this.dragged = false;
      this.suppressClickUntil = 0;
    }
  }

  private capture(): void {
    this.dragged = true;
    this.canvas.dataset.dragging = "true";
    const selection = window.getSelection();
    if (
      selection?.anchorNode !== null &&
      selection?.anchorNode !== undefined &&
      this.canvas.contains(selection.anchorNode)
    ) {
      selection.removeAllRanges();
    }
    for (const id of this.pointers.keys()) {
      if (!this.canvas.hasPointerCapture(id)) {
        this.canvas.setPointerCapture(id);
      }
    }
  }

  move(event: PointerEvent): void {
    const previous = this.pointers.get(event.pointerId);
    if (previous === undefined) {
      return;
    }
    const next = eventPoint(event);
    const other = [...this.pointers.entries()].find(
      ([id]) => id !== event.pointerId
    )?.[1];
    if (other === undefined) {
      if (!this.dragged && distance(next, previous.start) < DRAG_THRESHOLD) {
        return;
      }
      this.capture();
      this.pan(next.x - previous.x, next.y - previous.y);
    } else {
      const before = center(previous, other);
      const after = center(next, other);
      const span = distance(previous, other);
      this.capture();
      if (span > 0) {
        this.zoom(distance(next, other) / span, before);
      }
      this.pan(after.x - before.x, after.y - before.y);
    }
    this.pointers.set(event.pointerId, { ...next, start: previous.start });
    event.preventDefault();
  }

  cancel(): void {
    for (const id of this.pointers.keys()) {
      if (this.canvas.hasPointerCapture(id)) {
        this.canvas.releasePointerCapture(id);
      }
    }
    this.pointers.clear();
    delete this.canvas.dataset.dragging;
  }

  end(event: PointerEvent): void {
    if (!this.pointers.delete(event.pointerId)) {
      return;
    }
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    if (this.dragged) {
      this.suppressClickUntil = performance.now() + 500;
    }
    if (this.pointers.size === 0) {
      delete this.canvas.dataset.dragging;
    }
  }

  click(event: MouseEvent): void {
    if (
      event.detail > 0 &&
      performance.now() < this.suppressClickUntil &&
      event.target instanceof Node &&
      this.canvas.contains(event.target)
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
}

const views = new WeakMap<HTMLElement, DiagramView>();
const initialized = new WeakSet<Document>();

const viewOf = (target: EventTarget | null): DiagramView | undefined => {
  if (!(target instanceof Element)) {
    return undefined;
  }
  const root = target.closest<HTMLElement>("[data-mdxr-diagram]");
  const canvas = root?.querySelector<HTMLElement>(".mdxr-diagram-canvas");
  if (
    root === null ||
    canvas === undefined ||
    canvas === null ||
    canvas.querySelector("svg") === null
  ) {
    return undefined;
  }
  let view = views.get(root);
  if (view === undefined) {
    view = new DiagramView(root, canvas);
    views.set(root, view);
  }
  return view;
};

/** Delegation also covers delayed Mermaid SVGs and newly mounted tab panels. */
export const initDiagramViewports = (): void => {
  if (initialized.has(document)) {
    return;
  }
  initialized.add(document);
  document.body.classList.add("mdxr-diagrams-ready");
  let active: DiagramView | undefined;

  document.addEventListener(
    "click",
    (event) => {
      const view = viewOf(event.target);
      view?.click(event);
      if (event.defaultPrevented || !(event.target instanceof Element)) {
        return;
      }
      const button = event.target.closest<HTMLElement>("[data-diagram-action]");
      if (button !== null) {
        view?.action(button.dataset.diagramAction);
        // Controls inside a Graph figure must not activate the annotation picker.
        event.stopPropagation();
      }
    },
    true
  );

  document.addEventListener("keydown", (event) => {
    viewOf(event.target)?.key(event);
  });
  document.addEventListener(
    "wheel",
    (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.defaultPrevented) {
        return;
      }
      const view = viewOf(event.target);
      if (
        view === undefined ||
        !(event.target instanceof Node) ||
        !view.canvas.contains(event.target)
      ) {
        return;
      }
      event.preventDefault();
      const units = event.deltaMode === 1 ? 16 : 1;
      const delta = Math.max(-100, Math.min(100, event.deltaY * units));
      view.zoom(Math.exp(-delta * 0.01), eventPoint(event));
    },
    { passive: false }
  );

  document.addEventListener("pointerdown", (event) => {
    if (
      event.button !== 0 ||
      event.defaultPrevented ||
      !(event.target instanceof Element)
    ) {
      return;
    }
    const view = viewOf(event.target);
    if (
      view === undefined ||
      !view.canvas.contains(event.target) ||
      (active !== undefined && active !== view)
    ) {
      return;
    }
    active = view;
    view.start(event);
  });
  document.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse" && event.buttons === 0) {
      active?.cancel();
      active = undefined;
    } else {
      active?.move(event);
    }
  });
  const end = (event: PointerEvent): void => {
    active?.end(event);
    if (active?.pointers.size === 0) {
      active = undefined;
    }
  };
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
  document.addEventListener("lostpointercapture", (event) => {
    if (event.target === active?.canvas) {
      end(event);
    }
  });
  document.addEventListener("dragstart", (event) => {
    if (active !== undefined) {
      // Linked nodes use the same drag-to-pan gesture as the rest of the image.
      event.preventDefault();
    }
  });
  window.addEventListener("blur", () => {
    active?.cancel();
    active = undefined;
  });
};

import type { ReactElement, ReactNode } from "react";

import { Icon } from "./icon.js";

/** Static markup shared by diagrams; the lightweight client adds navigation. */
export const DiagramViewport = ({
  children,
  title,
  className,
  canvasClassName,
}: {
  children: ReactNode;
  title: string;
  className?: string;
  canvasClassName?: string;
}): ReactElement => (
  <div className={`doc-diagram ${className ?? ""}`} data-doc-diagram>
    <div className="doc-diagram-tools">
      <span className="doc-diagram-hint">
        Drag to pan · Ctrl/⌘ + scroll to zoom
      </span>
      <fieldset
        className="doc-diagram-actions"
        aria-label={`${title} zoom controls`}
      >
        <button
          type="button"
          data-diagram-action="out"
          aria-label="Zoom out"
          title="Zoom out (−)"
        >
          <Icon name="lucide:minus" />
        </button>
        <output
          data-diagram-scale
          aria-label="Zoom level"
          aria-live="polite"
          aria-atomic="true"
        >
          100%
        </output>
        <button
          type="button"
          data-diagram-action="in"
          aria-label="Zoom in"
          title="Zoom in (+)"
        >
          <Icon name="lucide:plus" />
        </button>
        <button
          type="button"
          data-diagram-action="reset"
          aria-label="Reset view"
          title="Reset view (0)"
        >
          <Icon name="lucide:rotate-ccw" />
        </button>
      </fieldset>
    </div>
    <section
      className={`doc-diagram-canvas ${canvasClassName ?? ""}`}
      aria-label={`${title}. Use + and − to zoom, arrow keys to pan, and 0 to reset.`}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- The diagram viewport supports keyboard zoom and pan.
      tabIndex={0}
    >
      {children}
    </section>
  </div>
);

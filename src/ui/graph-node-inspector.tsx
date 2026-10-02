import { useEffect, useRef, useState } from "react";
import type {
  KeyboardEvent,
  PointerEvent,
  ReactElement,
  ReactNode,
} from "react";

import { textOf } from "../define.js";
import { LocLink, TrimBody } from "./bits.js";
import { Icon } from "./icon.js";
import type { InteractiveNodeSpec } from "./interactive-graph-specs.js";

export const NodeDetails = ({
  node,
  onDismiss,
  moveHandle,
}: {
  node: InteractiveNodeSpec;
  onDismiss?: () => void;
  moveHandle?: ReactNode;
}): ReactElement => (
  <div>
    <div className="doc-graph-detail-heading">
      {moveHandle ?? (
        <p className="doc-graph-detail-title">{node.label ?? node.id}</p>
      )}
      {onDismiss === undefined ? null : (
        <button
          aria-label="詳細を閉じる"
          className="doc-graph-icon-button"
          onClick={onDismiss}
          title="詳細を閉じる"
          type="button"
        >
          <Icon className="h-3.5 w-3.5" name="lucide:x" />
        </button>
      )}
    </div>
    {node.note === undefined ||
    (onDismiss !== undefined && textOf(node.body).length > 0) ? null : (
      <p className="doc-graph-detail-note">{node.note}</p>
    )}
    {node.path === undefined ? null : (
      <LocLink href={node.href} lines={node.lines} path={node.path} />
    )}
    {node.path !== undefined || node.href === undefined ? null : (
      <LocLink href={node.href} path={node.label ?? node.id} />
    )}
    <TrimBody className="doc-graph-detail-body">{node.body}</TrimBody>
  </div>
);

interface InspectorPosition {
  x: number;
  y: number;
}

interface InspectorDrag extends InspectorPosition {
  pointerId: number;
}

const boundPosition = (
  inspector: HTMLElement,
  position: InspectorPosition
): InspectorPosition => ({
  x: Math.max(
    0,
    Math.min(
      position.x,
      (inspector.parentElement?.clientWidth ?? 0) - inspector.offsetWidth
    )
  ),
  y: Math.max(
    0,
    Math.min(
      position.y,
      (inspector.parentElement?.clientHeight ?? 0) - inspector.offsetHeight
    )
  ),
});

const KEYBOARD_STEP = 10;
const MOVE_DIRECTIONS: Record<string, InspectorPosition> = {
  ArrowDown: { x: 0, y: KEYBOARD_STEP },
  ArrowLeft: { x: -KEYBOARD_STEP, y: 0 },
  ArrowRight: { x: KEYBOARD_STEP, y: 0 },
  ArrowUp: { x: 0, y: -KEYBOARD_STEP },
};

export const NodeInspector = ({
  node,
  onDismiss,
}: {
  node: InteractiveNodeSpec;
  onDismiss: () => void;
}): ReactElement => {
  const inspectorRef = useRef<HTMLElement>(null);
  const dragRef = useRef<InspectorDrag | null>(null);
  const [position, setPosition] = useState<InspectorPosition | null>(null);

  useEffect(() => {
    const inspector = inspectorRef.current;
    const canvas = inspector?.parentElement;
    const observer = new ResizeObserver(() => {
      if (inspector === null) {
        return;
      }
      setPosition((current) => {
        if (current === null) {
          return current;
        }
        const bounded = boundPosition(inspector, current);
        return bounded.x === current.x && bounded.y === current.y
          ? current
          : bounded;
      });
    });
    if (canvas !== undefined && canvas !== null) {
      observer.observe(canvas);
    }
    if (inspector !== null) {
      observer.observe(inspector);
    }
    return () => {
      observer.disconnect();
    };
  }, []);

  const startDrag = (event: PointerEvent<HTMLButtonElement>): void => {
    const inspector = inspectorRef.current;
    if (!event.isPrimary || event.button !== 0 || inspector === null) {
      return;
    }
    const rect = inspector.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>): void => {
    const drag = dragRef.current;
    const inspector = inspectorRef.current;
    const canvas = inspector?.parentElement;
    if (
      drag?.pointerId !== event.pointerId ||
      inspector === null ||
      canvas === undefined ||
      canvas === null
    ) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    setPosition(
      boundPosition(inspector, {
        x: event.clientX - rect.left - drag.x,
        y: event.clientY - rect.top - drag.y,
      })
    );
  };

  const endDrag = (event: PointerEvent<HTMLButtonElement>): void => {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const moveByKeyboard = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const direction = MOVE_DIRECTIONS[event.key];
    const inspector = inspectorRef.current;
    if (direction === undefined || inspector === null) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setPosition(
      boundPosition(inspector, {
        x: inspector.offsetLeft + direction.x,
        y: inspector.offsetTop + direction.y,
      })
    );
  };

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape bubbles from the inspector's buttons and links.
    <section
      className="doc-graph-details"
      aria-label="ノードの詳細"
      aria-live="polite"
      ref={inspectorRef}
      style={
        position === null
          ? undefined
          : { bottom: "auto", left: position.x, right: "auto", top: position.y }
      }
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.stopPropagation();
          onDismiss();
        }
      }}
    >
      <NodeDetails
        node={node}
        onDismiss={onDismiss}
        moveHandle={
          <button
            aria-label="詳細を移動"
            className="doc-graph-detail-title doc-graph-detail-move"
            onKeyDown={moveByKeyboard}
            onLostPointerCapture={endDrag}
            onPointerCancel={endDrag}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            title="ドラッグまたは矢印キーで移動"
            type="button"
          >
            {node.label ?? node.id}
          </button>
        }
      />
    </section>
  );
};

import {
  Background,
  ControlButton,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  ReactFlow,
  useNodesState,
} from "@xyflow/react";
import type { NodeProps, NodeTypes } from "@xyflow/react";
import { useId, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import * as v from "valibot";

import { defineComponent, textOf } from "../define.js";
import type { DocProps, MdxrComponent } from "../define.js";
import { FINITE_NUMBER } from "../research.js";
import { attrFalse, attrTrue, BOOLISH_PROP } from "./attrs.js";
import { CaptionBar, Panel, Section, TrimBody } from "./bits.js";
import { fileIcon } from "./file-icon.js";
import type { GraphDirection } from "./graph-layout.js";
import { NodeDetails, NodeInspector } from "./graph-node-inspector.js";
import { GRAPH_COLOR_PROP } from "./graph-specs.js";
import { GraphViewRail } from "./graph-view-rail.js";
import { hasIcon, Icon } from "./icon.js";
import {
  graphViewSelection,
  interactiveGraphModel,
} from "./interactive-graph-model.js";
import type {
  InteractiveFlowNode,
  InteractiveGraphModel,
} from "./interactive-graph-model.js";
import { collectInteractiveSpecs } from "./interactive-graph-specs.js";
import type { GraphViewSpec } from "./interactive-graph-specs.js";
import { STATUS_ICON_CLS, STATUS_ICONS } from "./status-badge.js";
import {
  BORDER_CLS,
  CAPTION_TITLE_CLS,
  CHIP_BORDER_CLS,
  SUNKEN_CLS,
  TEXT,
  TEXT_SUB,
} from "./tones.js";

export { GraphGroup, GraphView } from "./interactive-graph-specs.js";

const GraphNodeCard = ({
  data,
  selected,
}: NodeProps<InteractiveFlowNode>): ReactElement => {
  const icon =
    data.spec?.icon ??
    (data.spec?.path === undefined ? undefined : fileIcon(data.spec.path));
  return (
    <div
      className={`doc-graph-node-card flex flex-col justify-center rounded-md border px-2.5 shadow-sm ${
        attrTrue(data.spec?.external)
          ? `border-dashed ${CHIP_BORDER_CLS} ${SUNKEN_CLS}`
          : `${BORDER_CLS} bg-white dark:bg-neutral-950`
      }`}
      data-dimmed={data.dimmed === true || undefined}
      data-selected={selected || undefined}
      data-external={attrTrue(data.spec?.external) || undefined}
    >
      <Handle
        id="in"
        isConnectable={false}
        position={data.targetPosition}
        type="target"
      />
      <div className="flex min-w-0 items-center gap-1.5">
        {hasIcon(icon) ? (
          <Icon className={`h-3.5 w-3.5 shrink-0 ${TEXT.muted}`} name={icon} />
        ) : null}
        <span className={`truncate font-mono text-xs font-medium ${TEXT.code}`}>
          {data.label}
        </span>
        {data.spec?.status === undefined ? null : (
          <Icon
            className={`h-3 w-3 shrink-0 ${STATUS_ICON_CLS[data.spec.status]}`}
            label={data.spec.status}
            name={STATUS_ICONS[data.spec.status]}
          />
        )}
      </div>
      {data.spec?.note === undefined ? null : (
        <p className={`mt-0.5 truncate ${TEXT_SUB} ${TEXT.faint}`}>
          {data.spec.note}
        </p>
      )}
      <Handle
        id="out"
        isConnectable={false}
        position={data.sourcePosition}
        type="source"
      />
    </div>
  );
};

const GraphGroupCard = ({
  data,
}: NodeProps<InteractiveFlowNode>): ReactElement => (
  <div className="doc-graph-group-card">
    <span>{data.label}</span>
  </div>
);

const NODE_TYPES = {
  "doc-group": GraphGroupCard,
  "doc-node": GraphNodeCard,
} satisfies NodeTypes;
const FIT_OPTIONS = { maxZoom: 1, padding: 0.15 };
const PRO_OPTIONS = { hideAttribution: true };
// Keep labels readable on narrow screens; the fit control still shows the whole graph.
const INITIAL_FIT_OPTIONS = { ...FIT_OPTIONS, minZoom: 0.65 };
const ARIA_LABELS = {
  "controls.fitView": "全体を表示",
  "controls.zoomIn": "拡大",
  "controls.zoomOut": "縮小",
  "minimap.ariaLabel": "図のミニマップ",
  "node.a11yDescription.default":
    "Enter または Space で選択。矢印キーで移動。Escape で選択解除。",
};

const GraphTextAlternative = ({
  model,
}: {
  model: InteractiveGraphModel;
}): ReactElement => (
  <details className="doc-graph-text-alternative">
    <summary className="doc-graph-icon-button" title="図のテキスト表示">
      <Icon className="h-3.5 w-3.5" name="lucide:text" />
      <span className="sr-only">図のテキスト表示</span>
    </summary>
    <div className="doc-graph-text-content">
      <ul>
        {model.specs.nodes.map((node) => (
          <li key={node.id}>
            <NodeDetails node={node} />
          </li>
        ))}
      </ul>
      <ul>
        {model.edges.map((edge) => (
          <li key={edge.id}>
            {edge.source} → {edge.target}
            {edge.label === undefined ? "" : ` — ${textOf(edge.label)}`}
          </li>
        ))}
      </ul>
      {model.specs.views.map((view) => (
        <div key={view.id}>
          <p className="doc-graph-detail-title">{view.label ?? view.id}</p>
          <TrimBody>{view.body}</TrimBody>
        </div>
      ))}
    </div>
  </details>
);

interface CanvasProps {
  defaultView: string;
  draggable: boolean;
  edgeColor?: string;
  height: number;
  minimap: boolean;
  model: InteractiveGraphModel;
  title: string;
  viewsCollapsed: boolean;
}

const GraphViewNote = ({ view }: { view?: GraphViewSpec }): ReactElement => (
  <div className="doc-graph-view-note" aria-live="polite">
    {view === undefined || textOf(view.body).length === 0 ? null : (
      <TrimBody>{view.body}</TrimBody>
    )}
  </div>
);

const InteractiveGraphCanvas = ({
  defaultView,
  draggable,
  edgeColor,
  height,
  minimap,
  model,
  title,
  viewsCollapsed,
}: CanvasProps): ReactElement => {
  // The inspector starts closed; include its dismiss icon in the hydration subset.
  hasIcon("lucide:x");
  const graphId = useId();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(model.nodes);
  const [activeView, setActiveView] = useState(defaultView);
  const view = model.specs.views.find((item) => item.id === activeView);
  const selection = useMemo(
    () =>
      view === undefined ? undefined : graphViewSelection(view, model.edges),
    [model.edges, view]
  );
  const displayedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          dimmed:
            node.type === "doc-node" &&
            selection !== undefined &&
            !selection.nodes.has(node.id),
        },
      })),
    [nodes, selection]
  );
  const displayedEdges = useMemo(
    () =>
      model.edges.map((edge) => {
        const color =
          edge.data?.color ??
          edgeColor ??
          (selection === undefined
            ? "var(--doc-graph-edge)"
            : "var(--doc-graph-accent)");
        return {
          ...edge,
          className:
            selection !== undefined && !selection.edges.has(edge.id)
              ? "doc-graph-edge-dimmed"
              : undefined,
          markerEnd: { color, type: MarkerType.ArrowClosed },
          style: {
            stroke: color,
            strokeWidth: selection === undefined ? 1.5 : 2,
          },
        };
      }),
    [edgeColor, model.edges, selection]
  );
  const selectedId = nodes.find(
    (node) => node.selected === true && node.data.spec !== undefined
  )?.id;
  const selected = model.specs.nodes.find((node) => node.id === selectedId);
  const dismissDetails = (): void => {
    const selectedElement = canvasRef.current?.querySelector<HTMLElement>(
      ".react-flow__node.selected"
    );
    setNodes((current) =>
      current.map((node) => ({ ...node, selected: false }))
    );
    selectedElement?.focus();
  };
  return (
    <Panel className="doc-interactive-graph">
      <CaptionBar className="doc-graph-caption">
        <span className={`${CAPTION_TITLE_CLS} min-w-0`}>
          <Icon className="h-3.5 w-3.5 shrink-0" name="lucide:workflow" />
          <span className="truncate">{title}</span>
        </span>
      </CaptionBar>
      <div className={`doc-graph-workspace ${SUNKEN_CLS}`} style={{ height }}>
        <GraphViewRail
          activeView={activeView}
          defaultCollapsed={viewsCollapsed}
          graphId={graphId}
          onChange={setActiveView}
          views={model.specs.views}
        />
        <div
          aria-labelledby={
            model.specs.views.length > 0
              ? `${graphId}-view-${activeView}`
              : undefined
          }
          className="doc-graph-canvas"
          id={`${graphId}-canvas`}
          ref={canvasRef}
          role={model.specs.views.length > 0 ? "tabpanel" : undefined}
        >
          <ReactFlow
            aria-label={title}
            ariaLabelConfig={ARIA_LABELS}
            deleteKeyCode={null}
            edges={displayedEdges}
            edgesReconnectable={false}
            fitView
            fitViewOptions={INITIAL_FIT_OPTIONS}
            height={height}
            id={graphId}
            maxZoom={2}
            minZoom={0.2}
            nodes={displayedNodes}
            nodesConnectable={false}
            nodesDraggable={draggable}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            preventScrolling={false}
            proOptions={PRO_OPTIONS}
            width={960}
            zoomOnScroll={false}
          >
            <Background color="var(--doc-graph-grid)" gap={16} size={0.75} />
            <Controls
              aria-label="図の操作"
              fitViewOptions={FIT_OPTIONS}
              orientation="horizontal"
              position="bottom-left"
              showInteractive={false}
            >
              {draggable ? (
                <ControlButton
                  aria-label="配置を戻す"
                  onClick={() => {
                    setNodes(model.nodes);
                  }}
                  title="配置を戻す"
                >
                  <Icon className="h-3.5 w-3.5" name="lucide:rotate-ccw" />
                </ControlButton>
              ) : null}
            </Controls>
            {minimap ? (
              <MiniMap
                maskColor="var(--doc-graph-minimap-mask)"
                nodeColor="var(--doc-graph-edge)"
                pannable
                position="top-right"
                style={{ height: 72, width: 120 }}
                zoomable
              />
            ) : null}
          </ReactFlow>
          {selected === undefined ? null : (
            <NodeInspector node={selected} onDismiss={dismissDetails} />
          )}
        </div>
      </div>
      <GraphViewNote view={view} />
      <GraphTextAlternative model={model} />
      {model.specs.rest.length === 0 ? null : (
        <div className="p-4">{model.specs.rest}</div>
      )}
    </Panel>
  );
};

interface GraphProps {
  children?: ReactNode;
  defaultView: string;
  direction: GraphDirection;
  draggable: boolean;
  edgeColor?: string;
  height: number;
  minimap: boolean;
  title: string;
  viewsCollapsed: boolean;
}

const InteractiveGraphDocument = ({
  children,
  direction,
  ...props
}: GraphProps): ReactElement => {
  const model = useMemo(
    () => interactiveGraphModel(collectInteractiveSpecs(children), direction),
    [children, direction]
  );
  if (
    props.defaultView !== "all" &&
    !model.specs.views.some((view) => view.id === props.defaultView)
  ) {
    throw new Error(
      `InteractiveGraph: unknown defaultView "${props.defaultView}"`
    );
  }
  if (model.specs.nodes.length === 0) {
    return (
      <Section title={props.title}>
        <p>ノードがありません。</p>
        {model.specs.rest}
      </Section>
    );
  }
  // Remount only when the authored graph changes; view switches preserve positions.
  const revision = JSON.stringify({
    defaultView: props.defaultView,
    direction,
    edges: model.edges,
    nodes: model.nodes.map((node) => ({
      body: textOf(node.data.spec?.body),
      external: attrTrue(node.data.spec?.external),
      href: node.data.spec?.href,
      icon: node.data.spec?.icon,
      id: node.id,
      label: node.data.label,
      lines: node.data.spec?.lines,
      note: node.data.spec?.note,
      parentId: node.parentId,
      path: node.data.spec?.path,
      position: node.position,
      status: node.data.spec?.status,
    })),
    viewsCollapsed: props.viewsCollapsed,
  });
  return <InteractiveGraphCanvas key={revision} model={model} {...props} />;
};

const ValidatedInteractiveGraph = defineComponent(
  {
    description:
      "React Flow による対話的な構成図。既存の <Node>/<Edge>、境界を表す <GraphGroup>、左側の縦タブから経路を切り替える <GraphView> を子に置く。viewsCollapsed は true でタブを折りたたみ、ホバー時に表示名を展開。edgeColor は線の既定色、Edge の color で個別指定。Node の children は選択時の詳細説明。direction は down|right|up|left、defaultView は GraphView の id。height は 300–1200、draggable は false で無効化、minimap は true で表示。移動はプレビュー内のみ",
    schema: v.looseObject({
      defaultView: v.optional(v.string(), "all"),
      direction: v.optional(
        v.picklist(["down", "right", "up", "left"]),
        "right"
      ),
      draggable: BOOLISH_PROP,
      edgeColor: GRAPH_COLOR_PROP,
      height: v.optional(
        v.pipe(FINITE_NUMBER, v.minValue(300), v.maxValue(1200)),
        520
      ),
      minimap: BOOLISH_PROP,
      title: v.optional(v.string(), "構成図"),
      viewsCollapsed: BOOLISH_PROP,
    }),
  },
  ({
    children,
    defaultView,
    direction,
    draggable,
    edgeColor,
    height,
    minimap,
    title,
    viewsCollapsed,
  }) => (
    <InteractiveGraphDocument
      defaultView={defaultView}
      direction={direction}
      draggable={!attrFalse(draggable)}
      edgeColor={edgeColor}
      height={height}
      minimap={attrTrue(minimap)}
      title={title}
      viewsCollapsed={attrTrue(viewsCollapsed)}
    >
      {children}
    </InteractiveGraphDocument>
  )
);

/** A named component keeps Storybook Fast Refresh's component boundary explicit. */
export const InteractiveGraph: MdxrComponent = (
  props: DocProps
): ReactElement => <ValidatedInteractiveGraph {...props} />;
InteractiveGraph.__mdxr = ValidatedInteractiveGraph.__mdxr;

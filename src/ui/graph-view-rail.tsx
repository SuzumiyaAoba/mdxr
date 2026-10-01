import { useState } from "react";
import type { KeyboardEvent, ReactElement } from "react";

import { hasIcon, Icon } from "./icon.js";
import type { GraphViewSpec } from "./interactive-graph-specs.js";

type RailMode = "compact" | "expanded" | "preview";

const showPreview = (mode: RailMode): RailMode =>
  mode === "compact" ? "preview" : mode;
const hidePreview = (mode: RailMode): RailMode =>
  mode === "preview" ? "compact" : mode;
const toggleExpanded = (mode: RailMode): RailMode =>
  mode === "expanded" ? "compact" : "expanded";

const nextTabIndex = (
  key: string,
  current: number,
  count: number
): number | undefined => {
  switch (key) {
    case "ArrowDown": {
      return (current + 1) % count;
    }
    case "ArrowUp": {
      return (current + count - 1) % count;
    }
    case "Home": {
      return 0;
    }
    case "End": {
      return count - 1;
    }
    default: {
      return undefined;
    }
  }
};

const navigateTabs = (event: KeyboardEvent<HTMLDivElement>): void => {
  if (!(event.target instanceof HTMLButtonElement)) {
    return;
  }
  const tabs = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  ];
  const current = tabs.indexOf(event.target);
  const next = nextTabIndex(event.key, current, tabs.length);
  if (current === -1 || next === undefined) {
    return;
  }
  event.preventDefault();
  tabs[next]?.click();
  tabs[next]?.focus();
};

interface ViewOption {
  icon?: string;
  id: string;
  label: string;
}

const GraphViewTab = ({
  graphId,
  index,
  onChange,
  option,
  selected,
}: {
  graphId: string;
  index: number;
  onChange: (value: string) => void;
  option: ViewOption;
  selected: boolean;
}): ReactElement => (
  <button
    aria-controls={`${graphId}-canvas`}
    aria-label={option.label}
    aria-selected={selected}
    className="mdxr-graph-view-tab"
    id={`${graphId}-view-${option.id}`}
    onClick={() => {
      onChange(option.id);
    }}
    role="tab"
    tabIndex={selected ? 0 : -1}
    type="button"
  >
    <span className="mdxr-graph-view-tab-icon">
      {hasIcon(option.icon) ? (
        <Icon className="h-3.5 w-3.5" name={option.icon} />
      ) : (
        <span className="font-mono text-[0.65rem]">{index}</span>
      )}
    </span>
    <span className="mdxr-graph-view-tab-label">{option.label}</span>
  </button>
);

export const GraphViewRail = ({
  activeView,
  defaultCollapsed,
  graphId,
  onChange,
  views,
}: {
  activeView: string;
  defaultCollapsed: boolean;
  graphId: string;
  onChange: (value: string) => void;
  views: GraphViewSpec[];
}): ReactElement | null => {
  const [mode, setMode] = useState<RailMode>(
    defaultCollapsed ? "compact" : "expanded"
  );
  const options = [
    { icon: "lucide:layers", id: "all", label: "全体" },
    ...views.map((view) => ({
      icon: view.icon,
      id: view.id,
      label: view.label ?? view.id,
    })),
  ];
  if (views.length === 0) {
    return null;
  }
  return (
    <div
      className="mdxr-graph-view-rail"
      data-mode={mode}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setMode(hidePreview);
        }
      }}
      onFocus={(event) => {
        if (event.target.matches(":focus-visible")) {
          setMode(showPreview);
        }
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          setMode(showPreview);
        }
      }}
      onPointerLeave={(event) => {
        if (event.currentTarget.querySelector(":focus-visible") === null) {
          setMode(hidePreview);
        }
      }}
    >
      <div className="mdxr-graph-view-rail-inner">
        <div className="mdxr-graph-view-rail-heading">パターン</div>
        <div
          aria-label="表示する経路"
          aria-orientation="vertical"
          className="mdxr-graph-view-tabs"
          onKeyDown={navigateTabs}
          role="tablist"
          tabIndex={-1}
        >
          {options.map((option, index) => (
            <GraphViewTab
              graphId={graphId}
              index={index}
              key={option.id}
              onChange={onChange}
              option={option}
              selected={activeView === option.id}
            />
          ))}
        </div>
        <button
          aria-expanded={mode !== "compact"}
          aria-label={
            mode === "expanded"
              ? "パターン一覧を折りたたむ"
              : "パターン一覧を展開"
          }
          className="mdxr-graph-view-toggle"
          onClick={() => {
            setMode(toggleExpanded);
          }}
          title={mode === "expanded" ? "折りたたむ" : "展開を固定する"}
          type="button"
        >
          <Icon className="h-3.5 w-3.5" name="lucide:panel-left" />
          <span className="mdxr-graph-view-tab-label">
            {mode === "expanded" ? "折りたたむ" : "展開を固定"}
          </span>
        </button>
      </div>
    </div>
  );
};

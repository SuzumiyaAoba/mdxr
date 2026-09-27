import { GitCompareArrows, History } from "lucide-react";

import type {
  DiffData,
  HistoryList,
  SourceData,
  Version,
} from "./workspace-api.js";
import { WorkspaceCode } from "./workspace-code.js";
import { WorkspaceDiff } from "./workspace-diff.js";
import type { ViewMode } from "./workspace-state.js";

const formatVersion = (version: Version): string => {
  let kind = "Edited";
  if (version.kind === "before-instruction") {
    kind = "Before instruction";
  } else if (version.kind === "initial") {
    kind = "Initial";
  }
  const time = new Date(version.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const date = new Date(version.createdAt).toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
  return `${kind} · ${date}, ${time}`;
};

const SourceCode = ({ source, syntax }: SourceData) => (
  <section className="mdxr-workspace-code" aria-label="MDX source code">
    <pre>
      {source.split("\n").map((text, index) => (
        <div className="mdxr-workspace-code-row" key={`line-${index + 1}`}>
          <span aria-hidden="true" className="mdxr-workspace-code-number">
            {index + 1}
          </span>
          <code className="mdxr-workspace-code-text">
            <WorkspaceCode text={text} syntax={syntax?.[index]} />
          </code>
        </div>
      ))}
    </pre>
  </section>
);

const VersionSelect = ({
  versions,
  selection,
  onChange,
}: {
  versions: Version[];
  selection: string;
  onChange: (id: string) => void;
}) => (
  <div className="mdxr-workspace-version">
    <History aria-hidden="true" size={14} />
    <label htmlFor="mdxr-version-select">Version</label>
    <select
      aria-label="Document version"
      id="mdxr-version-select"
      onChange={(event) => {
        onChange(event.target.value);
      }}
      value={selection}
    >
      <option value="latest">Latest</option>
      {versions.toReversed().map((version) => (
        <option key={version.id} value={version.id}>
          {formatVersion(version)}
        </option>
      ))}
    </select>
  </div>
);

interface DiffControlsProps {
  versions: Version[];
  comparison: string;
  additions: number;
  removals: number;
  showStats: boolean;
  diffLayout: "split" | "unified";
  wordDiff: boolean;
  onCompare: (id: string) => void;
  onLayout: (layout: "split" | "unified") => void;
  onWordDiff: (enabled: boolean) => void;
}

const DiffControls = ({
  versions,
  comparison,
  additions,
  removals,
  showStats,
  diffLayout,
  wordDiff,
  onCompare,
  onLayout,
  onWordDiff,
}: DiffControlsProps) => (
  <div className="mdxr-workspace-diff-toolbar">
    <label className="mdxr-workspace-compare">
      Compare with
      <select
        onChange={(event) => {
          onCompare(event.target.value);
        }}
        value={comparison}
        disabled={versions.length === 0}
      >
        {versions.map((version) => (
          <option key={version.id} value={version.id}>
            {formatVersion(version)}
          </option>
        ))}
      </select>
    </label>
    {showStats && (additions > 0 || removals > 0) && (
      <span
        className="mdxr-workspace-diff-stats"
        aria-label={`${additions} lines added, ${removals} lines removed`}
      >
        <span data-kind="add">+{additions}</span>
        <span data-kind="remove">−{removals}</span>
      </span>
    )}
    <div className="mdxr-workspace-diff-options">
      <fieldset className="mdxr-workspace-segmented" aria-label="Diff layout">
        <button
          type="button"
          aria-pressed={diffLayout === "unified"}
          onClick={() => {
            onLayout("unified");
          }}
        >
          Unified
        </button>
        <button
          type="button"
          aria-pressed={diffLayout === "split"}
          onClick={() => {
            onLayout("split");
          }}
        >
          Side-by-Side
        </button>
      </fieldset>
      <label className="mdxr-workspace-word-toggle">
        <input
          type="checkbox"
          checked={wordDiff}
          onChange={(event) => {
            onWordDiff(event.target.checked);
          }}
        />
        Word diff
      </label>
    </div>
  </div>
);

interface ViewContentProps {
  view: ViewMode;
  viewError: string;
  loading: boolean;
  source: SourceData;
  diff: DiffData;
  additions: number;
  removals: number;
  firstVersion: boolean;
  diffLayout: "split" | "unified";
  wordDiff: boolean;
}

const ViewContent = ({
  view,
  viewError,
  loading,
  source,
  diff,
  additions,
  removals,
  firstVersion,
  diffLayout,
  wordDiff,
}: ViewContentProps) => {
  if (viewError !== "") {
    return (
      <p className="mdxr-workspace-notice" role="alert">
        {viewError}
      </p>
    );
  } else if (loading) {
    return (
      <output className="mdxr-workspace-notice">
        Loading {view === "source" ? "source" : "changes"}…
      </output>
    );
  } else if (view === "source") {
    return <SourceCode {...source} />;
  } else if (additions === 0 && removals === 0) {
    return (
      <div className="mdxr-workspace-notice">
        <GitCompareArrows aria-hidden="true" size={24} />
        <strong>No changes</strong>
        <p>
          {firstVersion
            ? "Changes will appear here after the document is edited."
            : "These versions have the same content."}
        </p>
      </div>
    );
  }
  return <WorkspaceDiff {...diff} layout={diffLayout} wordDiff={wordDiff} />;
};

interface VersionPaneProps {
  history: HistoryList | undefined;
  selection: string;
  currentId: string | undefined;
  currentVersion: Version | undefined;
  onSelect: (id: string) => void;
}

export const HistoricalPreview = ({
  history,
  selection,
  currentId,
  currentVersion,
  onSelect,
  theme,
}: VersionPaneProps & { theme: "light" | "dark" }) => {
  if (selection === "latest" || currentId === undefined) {
    return null;
  }
  return (
    <section
      className="mdxr-workspace-pane mdxr-workspace-history-preview"
      aria-label="Historical document preview"
    >
      <div className="mdxr-workspace-pane-header">
        <h1>Preview</h1>
        <VersionSelect
          versions={history?.versions ?? []}
          selection={selection}
          onChange={onSelect}
        />
      </div>
      <iframe
        className="mdxr-workspace-iframe"
        key={currentId}
        sandbox=""
        src={`/__mdxr_history?view=preview&id=${encodeURIComponent(currentId)}&theme=${theme}`}
        title={`Document version ${currentVersion === undefined ? currentId : formatVersion(currentVersion)}`}
      />
    </section>
  );
};

interface DocumentPaneProps extends VersionPaneProps, ViewContentProps {
  comparison: string | undefined;
  onCompare: DiffControlsProps["onCompare"];
  onLayout: DiffControlsProps["onLayout"];
  onWordDiff: DiffControlsProps["onWordDiff"];
}

export const DocumentPane = ({
  history,
  selection,
  currentVersion,
  onSelect,
  comparison,
  onCompare,
  onLayout,
  onWordDiff,
  ...content
}: DocumentPaneProps) => {
  const {
    view,
    loading,
    viewError,
    additions,
    removals,
    diffLayout,
    wordDiff,
  } = content;
  return (
    <section
      key={view}
      className="mdxr-workspace-pane"
      aria-label={view === "source" ? "Raw MDX" : "Version differences"}
    >
      <div
        className={
          view === "source" ? "mdxr-workspace-source" : "mdxr-workspace-diff"
        }
      >
        <div className="mdxr-workspace-pane-header">
          <div>
            <h1>{view === "source" ? "Raw MDX" : "Changes"}</h1>
            <p>
              {currentVersion === undefined
                ? "Loading document…"
                : formatVersion(currentVersion)}
            </p>
          </div>
          <VersionSelect
            versions={history?.versions ?? []}
            selection={selection}
            onChange={onSelect}
          />
        </div>
        {view === "diff" && (
          <DiffControls
            versions={history?.versions ?? []}
            comparison={comparison ?? ""}
            additions={additions}
            removals={removals}
            showStats={!loading && viewError === ""}
            diffLayout={diffLayout}
            wordDiff={wordDiff}
            onCompare={onCompare}
            onLayout={onLayout}
            onWordDiff={onWordDiff}
          />
        )}
        <ViewContent {...content} />
      </div>
    </section>
  );
};

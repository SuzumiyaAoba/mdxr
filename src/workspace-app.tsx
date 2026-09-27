import {
  Code2,
  FileText,
  GitCompareArrows,
  MessageCircle,
  X,
} from "lucide-react";
import { createRoot } from "react-dom/client";

import { WorkspaceChat } from "./workspace-chat.js";
import { WorkspaceExportButton } from "./workspace-export.js";
import { DocumentPane, HistoricalPreview } from "./workspace-panes.js";
import { useWorkspace } from "./workspace-state.js";
import type { ViewMode } from "./workspace-state.js";
import { useWorkspaceTheme } from "./workspace-theme.js";

const tabs: { id: ViewMode; label: string; icon: typeof FileText }[] = [
  { icon: FileText, id: "preview", label: "Preview" },
  { icon: Code2, id: "source", label: "MDX" },
  { icon: GitCompareArrows, id: "diff", label: "Diff" },
];

const Workspace = ({ provider }: { provider?: "codex" | "claude" }) => {
  const theme = useWorkspaceTheme();
  const state = useWorkspace({ provider });
  const {
    history,
    conversation,
    view,
    setView,
    selection,
    currentId,
    currentVersion,
    comparison,
    setCompareId,
    chatOpen,
    setChatOpen,
    source,
    diff,
    diffLayout,
    setDiffLayout,
    wordDiff,
    setWordDiff,
    loading,
    viewError,
    chatError,
    sending,
    send,
    selectVersion,
    additions,
    removals,
  } = state;
  const versionProps = {
    currentId,
    currentVersion,
    history,
    onSelect: selectVersion,
    selection,
  };
  return (
    <>
      <header aria-label="Document tools" className="mdxr-workspace-controls">
        <nav className="mdxr-workspace-tabs" aria-label="Document view">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              aria-label={label}
              aria-pressed={view === id}
              key={id}
              onClick={() => {
                setView(id);
              }}
              title={label}
              type="button"
            >
              <Icon aria-hidden="true" size={15} /> <span>{label}</span>
            </button>
          ))}
          <WorkspaceExportButton />
        </nav>
      </header>

      {provider !== undefined && (
        <button
          aria-label={chatOpen ? "Close agent chat" : "Open agent chat"}
          className="mdxr-workspace-agent"
          data-active={chatOpen}
          aria-expanded={chatOpen}
          aria-controls="mdxr-workspace-chat"
          onClick={() => {
            setChatOpen((open) => !open);
          }}
          title={chatOpen ? "Close agent chat" : "Open agent chat"}
          type="button"
        >
          <span className="mdxr-workspace-agent-icons" aria-hidden="true">
            <MessageCircle
              className="mdxr-workspace-agent-open"
              size={18}
              strokeWidth={1.75}
            />
            <X
              className="mdxr-workspace-agent-close"
              size={18}
              strokeWidth={1.75}
            />
          </span>
          Agent
        </button>
      )}

      {view === "preview" ? (
        <HistoricalPreview {...versionProps} theme={theme} />
      ) : (
        <DocumentPane
          {...versionProps}
          view={view}
          viewError={viewError}
          loading={loading}
          source={source}
          diff={diff}
          additions={additions}
          removals={removals}
          firstVersion={history?.versions.length === 1}
          comparison={comparison}
          diffLayout={diffLayout}
          wordDiff={wordDiff}
          onCompare={setCompareId}
          onLayout={setDiffLayout}
          onWordDiff={setWordDiff}
        />
      )}

      {provider !== undefined && (
        <WorkspaceChat
          open={chatOpen}
          provider={provider}
          conversation={conversation}
          error={chatError}
          sending={sending}
          onClose={() => {
            setChatOpen(false);
            document
              .querySelector<HTMLButtonElement>(".mdxr-workspace-agent")
              ?.focus();
          }}
          onSend={send}
        />
      )}
    </>
  );
};

const root = document.querySelector<HTMLElement>("#mdxr-workspace-root");
if (root !== null) {
  const provider = root.dataset.agentProvider;
  createRoot(root).render(
    <Workspace
      provider={
        provider === "codex" || provider === "claude" ? provider : undefined
      }
    />
  );
}

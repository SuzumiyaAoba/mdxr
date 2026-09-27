import {
  Code2,
  FileText,
  GitCompareArrows,
  History,
  MessageCircle,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { WorkspaceChat } from "./workspace-chat.js";
import type { ChatMessage, ConversationData } from "./workspace-chat.js";
import { WorkspaceCode } from "./workspace-code.js";
import type { DiffLine } from "./workspace-diff-model.js";
import { WorkspaceDiff } from "./workspace-diff.js";
import { WorkspaceExportButton } from "./workspace-export.js";
import { parseSyntaxLines } from "./workspace-syntax.js";
import type { SyntaxLines } from "./workspace-syntax.js";
import { useWorkspaceTheme } from "./workspace-theme.js";

type ViewMode = "preview" | "source" | "diff";
type VersionKind = "initial" | "before-instruction" | "change";

interface Version {
  id: string;
  contentHash: string;
  createdAt: string;
  kind: VersionKind;
  size: number;
}

interface HistoryList {
  latestId: string;
  versions: Version[];
}

interface SourceData {
  source: string;
  syntax?: SyntaxLines;
}

interface DiffData {
  lines: DiffLine[];
  syntax?: { before: SyntaxLines; after: SyntaxLines };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isVersion = (value: unknown): value is Version =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.contentHash === "string" &&
  typeof value.createdAt === "string" &&
  typeof value.size === "number" &&
  (value.kind === "initial" ||
    value.kind === "before-instruction" ||
    value.kind === "change");

const isChatMessage = (value: unknown): value is ChatMessage =>
  isRecord(value) &&
  (value.role === "user" || value.role === "assistant") &&
  typeof value.content === "string" &&
  (value.html === undefined || typeof value.html === "string");

const isDiffLine = (value: unknown): value is DiffLine =>
  isRecord(value) &&
  (value.type === "context" ||
    value.type === "add" ||
    value.type === "remove") &&
  typeof value.text === "string";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const fetchJson = async (url: string, init?: RequestInit): Promise<unknown> => {
  const response = await fetch(url, init);
  const value: unknown = await response.json();
  if (!response.ok) {
    const detail =
      isRecord(value) && typeof value.error === "string"
        ? value.error
        : `Request failed (${response.status})`;
    throw new Error(detail);
  }
  return value;
};

const loadHistory = async (): Promise<HistoryList> => {
  const value = await fetchJson("/__mdxr_history");
  if (
    !isRecord(value) ||
    typeof value.latestId !== "string" ||
    !Array.isArray(value.versions) ||
    !value.versions.every(isVersion)
  ) {
    throw new Error("Could not read document versions");
  }
  return { latestId: value.latestId, versions: value.versions };
};

const loadConversation = async (): Promise<ConversationData> => {
  const value = await fetchJson("/__mdxr_agent");
  if (
    !isRecord(value) ||
    (value.provider !== "codex" && value.provider !== "claude") ||
    typeof value.busy !== "boolean" ||
    !Array.isArray(value.messages) ||
    !value.messages.every(isChatMessage)
  ) {
    throw new Error("Could not read agent conversation");
  }
  return {
    busy: value.busy,
    error: typeof value.error === "string" ? value.error : undefined,
    messages: value.messages,
    provider: value.provider,
    sessionId: typeof value.sessionId === "string" ? value.sessionId : null,
  };
};

const loadSource = async (id: string): Promise<SourceData> => {
  const value = await fetchJson(
    `/__mdxr_history?view=source&id=${encodeURIComponent(id)}`
  );
  if (!isRecord(value) || typeof value.source !== "string") {
    throw new Error("Could not read this MDX version");
  }
  return {
    source: value.source.replaceAll("\r\n", "\n"),
    syntax: parseSyntaxLines(value.syntax),
  };
};

const loadDiff = async (from: string, to: string): Promise<DiffData> => {
  const value = await fetchJson(
    `/__mdxr_history?view=diff&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  );
  if (
    !isRecord(value) ||
    !Array.isArray(value.lines) ||
    !value.lines.every(isDiffLine)
  ) {
    throw new Error("Could not compare these MDX versions");
  }
  const before = isRecord(value.syntax)
    ? parseSyntaxLines(value.syntax.before)
    : undefined;
  const after = isRecord(value.syntax)
    ? parseSyntaxLines(value.syntax.after)
    : undefined;
  return {
    lines: value.lines,
    syntax:
      before === undefined || after === undefined
        ? undefined
        : { after, before },
  };
};

const readStored = (key: string, fallback: string): string => {
  try {
    return sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

const store = (key: string, value: string): void => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Private browser modes may disable storage; the page still works.
  }
};

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

interface InstructionUpdates {
  conversation: (value: ConversationData) => void;
  history: (value: HistoryList) => void;
  chatError: (message: string) => void;
  viewError: (message: string) => void;
  complete: () => void;
}

const sendInstruction = async (
  message: string,
  update: InstructionUpdates
): Promise<void> => {
  try {
    const response = await fetchJson("/__mdxr_agent", {
      body: JSON.stringify({ message }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (
      isRecord(response) &&
      Array.isArray(response.messages) &&
      response.messages.every(isChatMessage) &&
      (response.provider === "codex" || response.provider === "claude")
    ) {
      update.conversation({
        busy: response.busy === true,
        messages: response.messages,
        provider: response.provider,
        sessionId:
          typeof response.sessionId === "string" ? response.sessionId : null,
      });
    }
    try {
      update.history(await loadHistory());
    } catch (error) {
      update.viewError(errorMessage(error));
    }
  } catch (error) {
    update.chatError(errorMessage(error));
    throw error;
  } finally {
    update.complete();
  }
};

const Workspace = ({ provider }: { provider?: "codex" | "claude" }) => {
  const theme = useWorkspaceTheme();
  const [history, setHistory] = useState<HistoryList>();
  const [conversation, setConversation] = useState<ConversationData>();
  const [view, setView] = useState<ViewMode>(() => {
    const stored = readStored("mdxr:workspace:view", "preview");
    return stored === "source" || stored === "diff" ? stored : "preview";
  });
  const [selection, setSelection] = useState(() =>
    readStored("mdxr:workspace:selection", "latest")
  );
  const [compareId, setCompareId] = useState("");
  const [chatOpen, setChatOpen] = useState(
    () => readStored("mdxr:workspace:chat", "closed") === "open"
  );
  const [source, setSource] = useState<SourceData>({ source: "" });
  const [diff, setDiff] = useState<DiffData>({ lines: [] });
  const [diffLayout, setDiffLayout] = useState<"unified" | "split">(() =>
    readStored("mdxr:workspace:diff-layout", "split") === "unified"
      ? "unified"
      : "split"
  );
  const [wordDiff, setWordDiff] = useState(
    () => readStored("mdxr:workspace:word-diff", "true") !== "false"
  );
  const [loadedView, setLoadedView] = useState("");
  const [viewError, setViewError] = useState("");
  const [chatError, setChatError] = useState("");
  const [sending, setSending] = useState(false);

  const currentId = selection === "latest" ? history?.latestId : selection;
  const currentVersion = history?.versions.find(
    (version) => version.id === currentId
  );
  const previousId = useMemo(() => {
    if (history === undefined || currentVersion === undefined) {
      return null;
    }
    const index = history.versions.findIndex(
      (version) => version.id === currentVersion.id
    );
    return history.versions
      .slice(0, index)
      .toReversed()
      .find((version) => version.contentHash !== currentVersion.contentHash)
      ?.id;
  }, [currentVersion, history]);
  const comparison = compareId === "" ? (previousId ?? currentId) : compareId;
  const viewKey = `${view}:${currentId ?? ""}:${view === "diff" ? comparison : ""}`;
  const loading = view !== "preview" && loadedView !== viewKey;
  const additions = diff.lines.filter((line) => line.type === "add").length;
  const removals = diff.lines.filter((line) => line.type === "remove").length;

  useEffect(() => {
    store("mdxr:workspace:diff-layout", diffLayout);
    store("mdxr:workspace:word-diff", String(wordDiff));
  }, [diffLayout, wordDiff]);

  useEffect(() => {
    document.body.classList.add("mdxr-workspace-enabled");
    const controls = document.querySelector<HTMLElement>(".mdxr-view-controls");
    const pagesButton = controls?.querySelector<HTMLButtonElement>(
      '[data-mdxr-view="pages"]'
    );
    const hasPages =
      document.querySelector("#mdxr-root [data-mdxr-page]") !== null;
    if (
      !hasPages &&
      controls !== null &&
      pagesButton !== undefined &&
      pagesButton !== null
    ) {
      controls.hidden = false;
      pagesButton.disabled = true;
      pagesButton.title = "Add an h2 heading to use pages";
    }
    return () => {
      if (
        !hasPages &&
        controls !== null &&
        pagesButton !== undefined &&
        pagesButton !== null
      ) {
        controls.hidden = true;
        pagesButton.disabled = false;
        pagesButton.removeAttribute("title");
      }
      document.body.classList.remove("mdxr-workspace-enabled");
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle(
      "mdxr-chat-open",
      chatOpen && provider !== undefined
    );
    document.body.classList.toggle(
      "mdxr-alternate-view",
      view !== "preview" || selection !== "latest"
    );
    store("mdxr:workspace:chat", chatOpen ? "open" : "closed");
    store("mdxr:workspace:view", view);
    store("mdxr:workspace:selection", selection);
  }, [chatOpen, provider, selection, view]);

  useEffect(() => {
    let active = true;
    const refresh = async (): Promise<void> => {
      try {
        const nextHistory = await loadHistory();
        if (active) {
          setHistory(nextHistory);
          if (
            selection !== "latest" &&
            !nextHistory.versions.some((version) => version.id === selection)
          ) {
            setSelection("latest");
          }
        }
      } catch (error) {
        if (active) {
          setViewError(errorMessage(error));
        }
      }
      if (provider !== undefined) {
        try {
          const nextConversation = await loadConversation();
          if (active) {
            setConversation(nextConversation);
          }
        } catch (error) {
          if (active) {
            setChatError(errorMessage(error));
          }
        }
      }
    };
    void refresh();
    const events = new EventSource("/__mdxr_events");
    events.addEventListener("agent", () => {
      void refresh();
    });
    return () => {
      active = false;
      events.close();
    };
  }, [provider, selection]);

  useEffect(() => {
    let active = true;
    const fetchView = async (id: string): Promise<void> => {
      try {
        if (view === "source") {
          const nextSource = await loadSource(id);
          if (active) {
            setSource(nextSource);
            setLoadedView(viewKey);
            setViewError("");
          }
        } else if (comparison !== undefined) {
          const nextDiff = await loadDiff(comparison, id);
          if (active) {
            setDiff(nextDiff);
            setLoadedView(viewKey);
            setViewError("");
          }
        }
      } catch (error) {
        if (active) {
          setViewError(errorMessage(error));
        }
      }
    };
    if (currentId !== undefined && view !== "preview") {
      void fetchView(currentId);
    }
    return () => {
      active = false;
    };
  }, [comparison, currentId, view, viewKey]);

  const send = async (message: string): Promise<void> => {
    if (message.trim() === "" || sending || conversation?.busy === true) {
      return;
    }
    setSending(true);
    setChatError("");
    await sendInstruction(message, {
      chatError: setChatError,
      complete: () => {
        setSending(false);
      },
      conversation: setConversation,
      history: setHistory,
      viewError: setViewError,
    });
  };

  const selectVersion = (id: string): void => {
    setSelection(id);
    setCompareId("");
  };

  const tabs: { id: ViewMode; label: string; icon: typeof FileText }[] = [
    { icon: FileText, id: "preview", label: "Preview" },
    { icon: Code2, id: "source", label: "MDX" },
    { icon: GitCompareArrows, id: "diff", label: "Diff" },
  ];

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

      {view === "preview" &&
        selection !== "latest" &&
        currentId !== undefined && (
          <section
            className="mdxr-workspace-pane mdxr-workspace-history-preview"
            aria-label="Historical document preview"
          >
            <div className="mdxr-workspace-pane-header">
              <h1>Preview</h1>
              <VersionSelect
                versions={history?.versions ?? []}
                selection={selection}
                onChange={selectVersion}
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
        )}

      {view !== "preview" && (
        <section
          key={view}
          className="mdxr-workspace-pane"
          aria-label={view === "source" ? "Raw MDX" : "Version differences"}
        >
          <div
            className={
              view === "source"
                ? "mdxr-workspace-source"
                : "mdxr-workspace-diff"
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
                onChange={selectVersion}
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
                onCompare={setCompareId}
                onLayout={setDiffLayout}
                onWordDiff={setWordDiff}
              />
            )}
            <ViewContent
              view={view}
              viewError={viewError}
              loading={loading}
              source={source}
              diff={diff}
              additions={additions}
              removals={removals}
              firstVersion={history?.versions.length === 1}
              diffLayout={diffLayout}
              wordDiff={wordDiff}
            />
          </div>
        </section>
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

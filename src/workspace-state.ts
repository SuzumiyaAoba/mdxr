import { useEffect, useMemo, useState } from "react";

import {
  errorMessage,
  loadConversation,
  loadDiff,
  loadHistory,
  loadSource,
  sendInstruction,
} from "./workspace-api.js";
import type { DiffData, HistoryList, SourceData } from "./workspace-api.js";
import type { ConversationData } from "./workspace-chat.js";
import { useWorkspaceDocument } from "./workspace-document.js";

export type ViewMode = "preview" | "source" | "diff";

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

const useWorkspacePreferences = () => {
  const [view, setView] = useState<ViewMode>(() => {
    const stored = readStored("mdxr:workspace:view", "preview");
    return stored === "source" || stored === "diff" ? stored : "preview";
  });
  const [selection, setSelection] = useState(() =>
    readStored("mdxr:workspace:selection", "latest")
  );
  const [chatOpen, setChatOpen] = useState(
    () => readStored("mdxr:workspace:chat", "closed") === "open"
  );
  const [diffLayout, setDiffLayout] = useState<"unified" | "split">(() =>
    readStored("mdxr:workspace:diff-layout", "split") === "unified"
      ? "unified"
      : "split"
  );
  const [wordDiff, setWordDiff] = useState(
    () => readStored("mdxr:workspace:word-diff", "true") !== "false"
  );
  useEffect(() => {
    store("mdxr:workspace:diff-layout", diffLayout);
    store("mdxr:workspace:word-diff", String(wordDiff));
  }, [diffLayout, wordDiff]);

  useEffect(() => {
    store("mdxr:workspace:chat", chatOpen ? "open" : "closed");
    store("mdxr:workspace:view", view);
    store("mdxr:workspace:selection", selection);
  }, [chatOpen, selection, view]);

  return {
    chatOpen,
    diffLayout,
    selection,
    setChatOpen,
    setDiffLayout,
    setSelection,
    setView,
    setWordDiff,
    view,
    wordDiff,
  };
};

export const useWorkspace = ({
  provider,
}: {
  provider?: "codex" | "claude";
}) => {
  const [history, setHistory] = useState<HistoryList>();
  const [conversation, setConversation] = useState<ConversationData>();
  const preferences = useWorkspacePreferences();
  const { view, selection, setSelection, chatOpen } = preferences;
  const [compareId, setCompareId] = useState("");
  const [source, setSource] = useState<SourceData>({ source: "" });
  const [diff, setDiff] = useState<DiffData>({ lines: [] });
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

  useWorkspaceDocument({ chatOpen, provider, selection, view });

  useEffect(() => {
    let active = true;
    const refreshConversation = async (): Promise<void> => {
      if (provider === undefined) {
        return;
      }

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
    };
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
      await refreshConversation();
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
  }, [provider, selection, setSelection]);

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

  return {
    ...preferences,
    additions,
    chatError,
    comparison,
    conversation,
    currentId,
    currentVersion,
    diff,
    history,
    loading,
    removals,
    selectVersion,
    send,
    sending,
    setCompareId,
    source,
    viewError,
  };
};

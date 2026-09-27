import { isRecord } from "./guards.js";
import type { ChatMessage, ConversationData } from "./workspace-chat.js";
import type { DiffLine } from "./workspace-diff-model.js";
import { parseSyntaxLines } from "./workspace-syntax.js";
import type { SyntaxLines } from "./workspace-syntax.js";

type VersionKind = "initial" | "before-instruction" | "change";

export interface Version {
  id: string;
  contentHash: string;
  createdAt: string;
  kind: VersionKind;
  size: number;
}

export interface HistoryList {
  latestId: string;
  versions: Version[];
}

export interface SourceData {
  source: string;
  syntax?: SyntaxLines;
}

export interface DiffData {
  lines: DiffLine[];
  syntax?: { before: SyntaxLines; after: SyntaxLines };
}

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

export const errorMessage = (error: unknown): string =>
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

export const loadHistory = async (): Promise<HistoryList> => {
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

export const loadConversation = async (): Promise<ConversationData> => {
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

export const loadSource = async (id: string): Promise<SourceData> => {
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

export const loadDiff = async (from: string, to: string): Promise<DiffData> => {
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

interface InstructionUpdates {
  conversation: (value: ConversationData) => void;
  history: (value: HistoryList) => void;
  chatError: (message: string) => void;
  viewError: (message: string) => void;
  complete: () => void;
}

export const sendInstruction = async (
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

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClaudeStreamSession } from "./claude-stream-session.js";
import { createCodexAppServerSession } from "./codex-app-server.js";
import { acquireFileLock } from "./file-lock.js";

export type AgentProvider = "codex" | "claude";

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentConversation {
  provider: AgentProvider;
  sessionId?: string;
  messages: AgentMessage[];
}

interface SessionStore {
  version: 1;
  documents: Record<string, AgentConversation>;
}

interface AgentConnection {
  send: (message: string) => Promise<{ sessionId: string; answer: string }>;
  enqueue?: (message: string) => Promise<{
    sessionId: string;
    completion: Promise<string>;
  }>;
  close: () => Promise<void>;
}

const emptyStore = (): SessionStore => ({ documents: {}, version: 1 });

const isConversation = (value: unknown): value is AgentConversation => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const item = value as Partial<AgentConversation>;
  return (
    (item.provider === "codex" || item.provider === "claude") &&
    (item.sessionId === undefined || typeof item.sessionId === "string") &&
    Array.isArray(item.messages) &&
    item.messages.every(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string"
    )
  );
};

const isSessionStore = (value: unknown): value is SessionStore => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const store = value as Partial<SessionStore>;
  return (
    store.version === 1 &&
    typeof store.documents === "object" &&
    store.documents !== null &&
    Object.values(store.documents).every(isConversation)
  );
};

const readStore = async (file: string): Promise<SessionStore> => {
  let raw: string;
  try {
    raw = await readFile(file, "utf-8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return emptyStore();
    }
    throw error;
  }
  const parsed: unknown = JSON.parse(raw);
  if (!isSessionStore(parsed)) {
    throw new Error("Invalid mdxr session store");
  }
  return parsed;
};

const writeStore = async (file: string, store: SessionStore): Promise<void> => {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = path.join(path.dirname(file), `.sessions-${randomUUID()}.tmp`);
  try {
    await writeFile(temp, `${JSON.stringify(store, null, 2)}\n`, {
      mode: 0o600,
    });
    await rename(temp, file);
  } catch (error) {
    const { rm } = await import("node:fs/promises");
    await rm(temp, { force: true });
    throw error;
  }
};

/** Keep one live provider connection for the lifetime of the MDX preview. */
export const createAgentSession = (
  filePath: string,
  provider: AgentProvider,
  initialSessionId?: string,
  serverEndpoint?: string
) => {
  const document = path.resolve(filePath);
  const cwd = process.cwd();
  const storePath = path.join(cwd, ".mdxr", "sessions.json");
  let busy = false;
  let lastError: string | undefined;
  let onUpdate: (() => void) | undefined;
  let connection: AgentConnection | undefined;
  let claudeConversation: AgentConversation = { messages: [], provider };

  const savedConversation = async (): Promise<AgentConversation> => {
    if (provider === "claude") {
      return claudeConversation;
    }
    const store = await readStore(storePath);
    const saved = store.documents[document];
    if (
      saved?.provider === provider &&
      (initialSessionId === undefined || saved.sessionId === initialSessionId)
    ) {
      return saved;
    }
    return { messages: [], provider, sessionId: initialSessionId };
  };

  const current = async (): Promise<
    AgentConversation & { busy: boolean; error?: string }
  > => ({
    ...(await savedConversation()),
    busy,
    error: lastError,
  });

  const saveConversation = async (
    conversation: AgentConversation
  ): Promise<void> => {
    if (provider === "claude") {
      claudeConversation = conversation;
      return;
    }
    await mkdir(path.dirname(storePath), { recursive: true });
    const release = await acquireFileLock(
      path.join(path.dirname(storePath), ".sessions.lock"),
      "MDX session store"
    );
    try {
      const store = await readStore(storePath);
      store.documents[document] = conversation;
      await writeStore(storePath, store);
    } finally {
      await release();
    }
  };

  const send = async (
    message: string
  ): Promise<AgentConversation & { busy: boolean }> => {
    if (busy) {
      throw new Error("Agent is already responding");
    }
    busy = true;
    lastError = undefined;
    let awaitingQueuedAnswer = false;
    try {
      const conversation = await savedConversation();
      connection ??=
        provider === "codex"
          ? createCodexAppServerSession({
              cwd,
              endpoint: serverEndpoint,
              initialSessionId: conversation.sessionId,
            })
          : createClaudeStreamSession(cwd);
      const prompt =
        conversation.sessionId === undefined
          ? `This message was sent from the preview of ${document}.\n\n${message}`
          : message;
      if (
        provider === "codex" &&
        conversation.sessionId !== undefined &&
        connection.enqueue !== undefined
      ) {
        const queued = await connection.enqueue(prompt);
        const updated: AgentConversation = {
          messages: [
            ...conversation.messages,
            { content: message, role: "user" },
          ],
          provider,
          sessionId: queued.sessionId,
        };
        await saveConversation(updated);
        void (async () => {
          try {
            const answer = await queued.completion;
            await saveConversation({
              ...updated,
              messages: [
                ...updated.messages,
                { content: answer, role: "assistant" },
              ],
            });
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
          } finally {
            busy = false;
            // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Notify the preview after a background answer is saved.
            onUpdate?.();
          }
        })();
        awaitingQueuedAnswer = true;
        return { ...updated, busy: true };
      }
      const response = await connection.send(prompt);
      const updated: AgentConversation = {
        messages: [
          ...conversation.messages,
          { content: message, role: "user" },
          { content: response.answer, role: "assistant" },
        ],
        provider,
        sessionId: response.sessionId,
      };
      await saveConversation(updated);
      return { ...updated, busy: false };
    } finally {
      if (!awaitingQueuedAnswer) {
        busy = false;
      }
    }
  };

  const close = async (): Promise<void> => {
    await connection?.close();
  };

  // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Register a notification hook for the long-lived preview.
  const setOnUpdate = (callback: () => void): void => {
    onUpdate = callback;
  };

  return { close, current, send, setOnUpdate };
};

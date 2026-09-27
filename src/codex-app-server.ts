import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { connect as connectSocket } from "node:net";
import { homedir } from "node:os";
import path from "node:path";

import { WebSocket } from "ws";
import type { RawData } from "ws";

const DEFAULT_ENDPOINT = "ws://127.0.0.1:4500";
const DEFAULT_DAEMON_WS_ENDPOINT = "ws://localhost/";
const RPC_TIMEOUT_MS = 30_000;
const MAX_BUFFERED_TURNS = 8;

type RpcId = number | string;
export type CodexAppServerErrorKind = "general" | "session-conflict";

interface PendingRequest {
  method: string;
  reject: (error: Error) => void;
  resolve: (value: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface AgentMessageState {
  phase?: string;
  text: string;
}

interface TurnState {
  completedTurn?: Record<string, unknown>;
  messageOrder: string[];
  messages: Map<string, AgentMessageState>;
}

interface QueuedMessage {
  acknowledged: boolean;
  clientUserMessageId: string;
  completion: Deferred<string>;
  outcome?: QueuedOutcome;
  turnId?: string;
}

type QueuedOutcome =
  | { answer: string; type: "resolve" }
  | { error: Error; type: "reject" };

interface ActiveTurn {
  reject: (error: Error) => void;
  resolve: (value: { answer: string; sessionId: string }) => void;
  turnId?: string;
}

interface Deferred<T> {
  promise: Promise<T>;
  reject: (reason: Error) => void;
  resolve: (value: T) => void;
}

export interface CodexAppServerSessionOptions {
  /** Same WebSocket endpoint passed to `codex --remote`. */
  endpoint?: string;
  cwd?: string;
  /** Exact thread ID to resume. Resume failures never create a replacement thread. */
  initialSessionId?: string;
}

export interface CodexAppServerSession {
  send: (message: string) => Promise<{ sessionId: string; answer: string }>;
  enqueue: (
    message: string
  ) => Promise<{ sessionId: string; completion: Promise<string> }>;
  close: () => Promise<void>;
}

export class CodexAppServerError extends Error {
  readonly kind: CodexAppServerErrorKind;

  constructor(
    message: string,
    kind: CodexAppServerErrorKind = "general",
    options?: ErrorOptions
  ) {
    super(message, options);
    this.kind = kind;
    this.name = "CodexAppServerError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isRpcId = (value: unknown): value is RpcId =>
  typeof value === "number" || typeof value === "string";

const decodeFrame = (data: RawData): string => {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf-8");
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf-8");
  }
  return data.toString("utf-8");
};

interface ResolvedEndpoint {
  socketPath?: string;
  url: string;
}

const defaultDaemonSocketPath = (): string => {
  const configuredCodexHome = process.env.CODEX_HOME;
  const codexHome =
    configuredCodexHome === undefined || configuredCodexHome.length === 0
      ? path.join(homedir(), ".codex")
      : configuredCodexHome;
  return path.join(codexHome, "app-server-control", "app-server-control.sock");
};

const resolveEndpoint = (
  endpoint: string | undefined,
  useDefaultDaemon: boolean
): ResolvedEndpoint => {
  const resolved =
    endpoint ??
    process.env.CODEX_APP_SERVER_URL ??
    (useDefaultDaemon
      ? `unix://${defaultDaemonSocketPath()}`
      : DEFAULT_ENDPOINT);
  let parsed: URL;
  try {
    parsed = new URL(resolved);
  } catch (error) {
    throw new CodexAppServerError(
      "Invalid Codex App Server endpoint.",
      "general",
      {
        cause: error,
      }
    );
  }
  if (parsed.protocol === "unix:") {
    let socketPath: string;
    try {
      socketPath = decodeURIComponent(parsed.pathname);
    } catch (error) {
      throw new CodexAppServerError(
        "Invalid Codex App Server Unix socket path.",
        "general",
        { cause: error }
      );
    }
    if (
      parsed.host !== "" ||
      !path.isAbsolute(socketPath) ||
      parsed.search !== "" ||
      parsed.hash !== ""
    ) {
      throw new CodexAppServerError(
        "Codex App Server Unix endpoint must be unix:///absolute/path without query or fragment."
      );
    }
    return { socketPath, url: DEFAULT_DAEMON_WS_ENDPOINT };
  }
  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    throw new CodexAppServerError(
      "Codex App Server endpoint must use ws://, wss://, or unix:///absolute/path."
    );
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new CodexAppServerError(
      "Codex App Server endpoint must not contain credentials; configure authentication separately."
    );
  }
  return { url: resolved };
};

const isActiveWriterConflict = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("thread-store conflict") ||
    normalized.includes("already has an active writer") ||
    normalized.includes("active writer conflict")
  );
};

const makeTurnState = (): TurnState => ({
  messageOrder: [],
  messages: new Map(),
});

const getAgentMessage = (
  state: TurnState,
  itemId: string
): AgentMessageState => {
  let item = state.messages.get(itemId);
  if (item === undefined) {
    item = { text: "" };
    state.messages.set(itemId, item);
    state.messageOrder.push(itemId);
  }
  return item;
};

const getNotificationTurnId = (
  params: Record<string, unknown>
): string | undefined => {
  const { turnId, turn } = params;
  if (typeof turnId === "string") {
    return turnId;
  }
  if (!isRecord(turn)) {
    return undefined;
  }
  return typeof turn.id === "string" ? turn.id : undefined;
};

// A deferred is needed because Codex can stream notifications before the
// matching turn/start response identifies the turn ID.
const createDeferred = <T>(): Deferred<T> => {
  let handlers:
    | {
        reject: (reason: Error) => void;
        resolve: (value: T) => void;
      }
    | undefined;
  // oxlint-disable-next-line promise/avoid-new -- This deferred joins JSON-RPC response and stream events.
  const promise = new Promise<T>((resolve, reject) => {
    handlers = { reject, resolve };
  });
  if (handlers === undefined) {
    throw new Error("Could not create a Codex turn completion promise.");
  }
  return { promise, reject: handlers.reject, resolve: handlers.resolve };
};

const settleQueuedMessage = (
  queuedMessage: QueuedMessage,
  outcome: QueuedOutcome
): void => {
  if (!queuedMessage.acknowledged) {
    queuedMessage.outcome = outcome;
    return;
  }
  if (outcome.type === "resolve") {
    queuedMessage.completion.resolve(outcome.answer);
  } else {
    queuedMessage.completion.reject(outcome.error);
  }
};

const acknowledgeQueuedMessage = (queuedMessage: QueuedMessage): void => {
  queuedMessage.acknowledged = true;
  if (queuedMessage.outcome !== undefined) {
    settleQueuedMessage(queuedMessage, queuedMessage.outcome);
  }
};

/**
 * Create a long-lived JSON-RPC client for the same Codex App Server used by
 * `codex --remote`. Calls reuse one socket and one thread until `close()`.
 */
export const createCodexAppServerSession = (
  options: CodexAppServerSessionOptions = {}
): CodexAppServerSession => {
  const endpoint = resolveEndpoint(
    options.endpoint,
    options.initialSessionId !== undefined
  );
  let socket: WebSocket | undefined;
  let connectionPromise: Promise<void> | undefined;
  let nextRequestId = 1;
  let threadId: string | undefined;
  let activeTurn: ActiveTurn | undefined;
  let isClosed = false;
  let isClosing = false;
  let closePromise: Promise<void> | undefined;
  let busy = false;
  let attachedToExistingThread = options.initialSessionId !== undefined;
  const pendingRequests = new Map<RpcId, PendingRequest>();
  const turns = new Map<string, TurnState>();
  const queuedMessagesByClientId = new Map<string, QueuedMessage>();
  const queuedMessagesByTurnId = new Map<string, QueuedMessage>();

  const makeTransportError = (reason: string, cause?: unknown): Error =>
    new CodexAppServerError(
      `Codex App Server connection ${reason}${cause instanceof Error ? `: ${cause.message}` : ""}`,
      "general",
      cause instanceof Error ? { cause } : undefined
    );

  const rejectPendingRequests = (error: Error): void => {
    for (const [id, pending] of pendingRequests) {
      clearTimeout(pending.timeout);
      pendingRequests.delete(id);
      pending.reject(error);
    }
  };

  const rejectQueuedMessages = (error: Error): void => {
    for (const queuedMessage of queuedMessagesByClientId.values()) {
      settleQueuedMessage(queuedMessage, { error, type: "reject" });
    }
    queuedMessagesByClientId.clear();
    queuedMessagesByTurnId.clear();
  };

  const sendFrame = (value: Record<string, unknown>): void => {
    if (socket?.readyState !== WebSocket.OPEN) {
      throw makeTransportError("is not open.");
    }
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- ws reports asynchronous socket write failures through this callback.
    socket.send(JSON.stringify(value), (error) => {
      if (error instanceof Error) {
        const wrapped = makeTransportError(
          "failed while sending a message.",
          error
        );
        rejectPendingRequests(wrapped);
        activeTurn?.reject(wrapped);
        rejectQueuedMessages(wrapped);
      }
    });
  };

  const replyToServerRequest = (id: RpcId, method: string): void => {
    // A resumed thread can have an interactive TUI attached to the same daemon.
    // Approval requests are shared with subscribed clients, so let that UI decide.
    if (attachedToExistingThread) {
      return;
    }
    if (
      method === "item/commandExecution/requestApproval" ||
      method === "item/fileChange/requestApproval"
    ) {
      sendFrame({ id, result: { decision: "decline" } });
      return;
    }
    if (
      method === "item/tool/requestUserInput" ||
      method === "mcpServer/elicitation/request"
    ) {
      sendFrame({ id, result: { action: "decline", content: null } });
      return;
    }
    sendFrame({
      error: {
        code: -32_601,
        message: `mdxr does not support the server request ${method}`,
      },
      id,
    });
  };

  const finishActiveTurnIfReady = (): void => {
    const currentTurn = activeTurn;
    if (currentTurn === undefined || currentTurn.turnId === undefined) {
      return;
    }
    const activeTurnId = currentTurn.turnId;
    const turn = turns.get(activeTurnId);
    const completedTurn = turn?.completedTurn;
    if (turn === undefined || completedTurn === undefined) {
      return;
    }
    const { status } = completedTurn;
    if (status !== "completed") {
      const { error } = completedTurn;
      const detail = isRecord(error) ? error.message : undefined;
      const message =
        typeof detail === "string"
          ? `Codex turn ${String(status)}: ${detail}`
          : `Codex turn finished with status ${String(status)}.`;
      currentTurn.reject(new CodexAppServerError(message));
      return;
    }

    const messages = turn.messageOrder.flatMap((itemId) => {
      const item = turn.messages.get(itemId);
      return item === undefined ? [] : [item];
    });
    if (Array.isArray(completedTurn.items)) {
      for (const item of completedTurn.items) {
        if (
          isRecord(item) &&
          item.type === "agentMessage" &&
          typeof item.id === "string" &&
          typeof item.text === "string"
        ) {
          const message = getAgentMessage(turn, item.id);
          message.text = item.text;
          if (typeof item.phase === "string") {
            message.phase = item.phase;
          }
        }
      }
    }
    const completedMessages = turn.messageOrder.flatMap((itemId) => {
      const item = turn.messages.get(itemId);
      return item === undefined ? [] : [item];
    });
    const answer =
      completedMessages
        .toReversed()
        .find((item) => item.phase === "final_answer") ??
      completedMessages.at(-1) ??
      messages.at(-1);
    if (
      threadId === undefined ||
      answer === undefined ||
      answer.text.trim() === ""
    ) {
      currentTurn.reject(new CodexAppServerError("Codex returned no answer."));
      return;
    }
    currentTurn.resolve({ answer: answer.text, sessionId: threadId });
  };

  const finishQueuedMessageIfReady = (
    turnId: string,
    turn: TurnState
  ): void => {
    const queuedMessage = queuedMessagesByTurnId.get(turnId);
    const { completedTurn } = turn;
    if (queuedMessage === undefined || completedTurn === undefined) {
      return;
    }
    queuedMessagesByTurnId.delete(turnId);
    queuedMessagesByClientId.delete(queuedMessage.clientUserMessageId);
    const { status, error } = completedTurn;
    if (status !== "completed") {
      const detail = isRecord(error) ? error.message : undefined;
      settleQueuedMessage(queuedMessage, {
        error: new CodexAppServerError(
          typeof detail === "string"
            ? `Codex turn ${String(status)}: ${detail}`
            : `Codex turn finished with status ${String(status)}.`
        ),
        type: "reject",
      });
      return;
    }
    const messages = turn.messageOrder.flatMap((itemId) => {
      const item = turn.messages.get(itemId);
      return item === undefined ? [] : [item];
    });
    if (Array.isArray(completedTurn.items)) {
      for (const item of completedTurn.items) {
        if (
          isRecord(item) &&
          item.type === "agentMessage" &&
          typeof item.id === "string" &&
          typeof item.text === "string"
        ) {
          const message = getAgentMessage(turn, item.id);
          message.text = item.text;
          if (typeof item.phase === "string") {
            message.phase = item.phase;
          }
        }
      }
    }
    const completedMessages = turn.messageOrder.flatMap((itemId) => {
      const item = turn.messages.get(itemId);
      return item === undefined ? [] : [item];
    });
    const answer =
      completedMessages
        .toReversed()
        .find((item) => item.phase === "final_answer") ??
      completedMessages.at(-1) ??
      messages.at(-1);
    if (answer === undefined || answer.text.trim() === "") {
      settleQueuedMessage(queuedMessage, {
        error: new CodexAppServerError(
          "Codex returned no answer for the queued message."
        ),
        type: "reject",
      });
      return;
    }
    settleQueuedMessage(queuedMessage, {
      answer: answer.text,
      type: "resolve",
    });
  };

  const getTurnState = (turnId: string): TurnState => {
    const existing = turns.get(turnId);
    if (existing !== undefined) {
      return existing;
    }
    const created = makeTurnState();
    turns.set(turnId, created);
    return created;
  };

  const handleAgentMessageDelta = (
    turn: TurnState,
    params: Record<string, unknown>
  ): void => {
    const { itemId, delta } = params;
    if (typeof itemId !== "string" || typeof delta !== "string") {
      return;
    }
    getAgentMessage(turn, itemId).text += delta;
  };

  const handleCompletedItem = (
    turn: TurnState,
    params: Record<string, unknown>
  ): void => {
    const { item } = params;
    if (
      !isRecord(item) ||
      item.type !== "agentMessage" ||
      typeof item.id !== "string" ||
      typeof item.text !== "string"
    ) {
      return;
    }
    const agentMessage = getAgentMessage(turn, item.id);
    agentMessage.text = item.text;
    if (typeof item.phase === "string") {
      agentMessage.phase = item.phase;
    }
  };

  const handleStartedItem = (
    turnId: string,
    params: Record<string, unknown>
  ): void => {
    const { item } = params;
    if (!isRecord(item) || item.type !== "userMessage") {
      return;
    }
    const { clientId } = item;
    if (typeof clientId !== "string") {
      return;
    }
    const queuedMessage = queuedMessagesByClientId.get(clientId);
    if (queuedMessage === undefined) {
      return;
    }
    queuedMessage.turnId = turnId;
    queuedMessagesByTurnId.set(turnId, queuedMessage);
  };

  const pruneTurnBuffer = (activeTurnId: string): void => {
    if (turns.size <= MAX_BUFFERED_TURNS) {
      return;
    }
    const oldestTurnId = turns.keys().next().value;
    if (oldestTurnId !== undefined && oldestTurnId !== activeTurnId) {
      turns.delete(oldestTurnId);
    }
  };

  const handleNotification = (message: Record<string, unknown>): void => {
    const { method, params } = message;
    if (
      typeof method !== "string" ||
      !isRecord(params) ||
      params.threadId !== threadId
    ) {
      return;
    }
    const turnId = getNotificationTurnId(params);
    if (turnId === undefined) {
      return;
    }
    const turn = getTurnState(turnId);

    switch (method) {
      case "item/started": {
        handleStartedItem(turnId, params);
        break;
      }
      case "item/agentMessage/delta": {
        handleAgentMessageDelta(turn, params);
        break;
      }
      case "item/completed": {
        handleCompletedItem(turn, params);
        break;
      }
      case "turn/completed": {
        if (isRecord(params.turn)) {
          turn.completedTurn = params.turn;
          finishActiveTurnIfReady();
          finishQueuedMessageIfReady(turnId, turn);
        }
        break;
      }
      default: {
        break;
      }
    }
    pruneTurnBuffer(activeTurn?.turnId ?? "");
  };

  const handleResponse = (message: Record<string, unknown>): void => {
    const { id } = message;
    if (!isRpcId(id)) {
      return;
    }
    const pending = pendingRequests.get(id);
    if (pending === undefined) {
      return;
    }
    pendingRequests.delete(id);
    clearTimeout(pending.timeout);
    const { error } = message;
    if (isRecord(error)) {
      const messageText =
        typeof error.message === "string"
          ? error.message
          : "Unknown JSON-RPC error";
      const isResumeConflict =
        pending.method === "thread/resume" &&
        options.initialSessionId !== undefined &&
        isActiveWriterConflict(messageText);
      if (isResumeConflict && options.initialSessionId !== undefined) {
        pending.reject(
          new CodexAppServerError(
            `Cannot resume Codex session ${options.initialSessionId}: another active Codex App Server owns this session. Connect mdxr and the Codex TUI to the same --remote endpoint. The session ID was not changed.`,
            "session-conflict"
          )
        );
        return;
      }
      pending.reject(
        new CodexAppServerError(`${pending.method} failed: ${messageText}`)
      );
      return;
    }
    pending.resolve(message.result);
  };

  const handleMessage = (data: RawData): void => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(decodeFrame(data)) as unknown;
    } catch {
      return;
    }
    if (!isRecord(parsed)) {
      return;
    }
    const { id, method } = parsed;
    if (isRpcId(id) && typeof method === "string") {
      replyToServerRequest(id, method);
    } else if (isRpcId(id)) {
      handleResponse(parsed);
    } else {
      handleNotification(parsed);
    }
  };

  const failConnection = (error: Error): void => {
    rejectPendingRequests(error);
    activeTurn?.reject(error);
    rejectQueuedMessages(error);
  };

  const request = async (
    method: string,
    params: Record<string, unknown>
  ): Promise<unknown> => {
    const id = nextRequestId;
    nextRequestId += 1;
    const response = createDeferred<unknown>();
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      response.reject(
        new CodexAppServerError(
          `${method} timed out after ${RPC_TIMEOUT_MS / 1000} seconds.`
        )
      );
    }, RPC_TIMEOUT_MS);
    timeout.unref?.();
    pendingRequests.set(id, {
      method,
      reject: response.reject,
      resolve: response.resolve,
      timeout,
    });
    try {
      sendFrame({ id, method, params });
    } catch (error) {
      pendingRequests.delete(id);
      clearTimeout(timeout);
      response.reject(
        error instanceof Error ? error : new Error(String(error))
      );
    }
    return await response.promise;
  };

  const notify = (method: string, params: Record<string, unknown>): void => {
    sendFrame({ method, params });
  };

  const connect = async (): Promise<void> => {
    if (isClosed) {
      throw makeTransportError("was closed by mdxr.");
    }
    if (connectionPromise !== undefined) {
      await connectionPromise;
      return;
    }
    const { socketPath } = endpoint;
    const nextSocket = new WebSocket(endpoint.url, {
      ...(socketPath === undefined
        ? {}
        : { createConnection: () => connectSocket(socketPath) }),
      perMessageDeflate: false,
    });
    socket = nextSocket;
    nextSocket.on("message", handleMessage);
    nextSocket.on("error", (error) => {
      failConnection(makeTransportError("failed.", error));
    });
    nextSocket.on("close", (code, reason) => {
      if (!isClosing) {
        const detail = reason.toString("utf-8");
        const suffix = detail === "" ? "" : `: ${detail}`;
        failConnection(
          makeTransportError(`closed unexpectedly (${code}${suffix}).`)
        );
      }
    });
    connectionPromise = (async () => {
      await once(nextSocket, "open");
      await request("initialize", {
        capabilities: { experimentalApi: true },
        clientInfo: { name: "mdxr", title: "mdxr", version: "0.7.0" },
      });
      notify("initialized", {});
    })();
    await connectionPromise;
  };

  const ensureThread = async (): Promise<string> => {
    if (threadId !== undefined) {
      return threadId;
    }
    if (options.initialSessionId !== undefined) {
      const result = await request("thread/resume", {
        excludeTurns: true,
        threadId: options.initialSessionId,
      });
      const thread = isRecord(result) ? result.thread : undefined;
      const resumedId = isRecord(thread) ? thread.id : undefined;
      if (typeof resumedId !== "string") {
        throw new CodexAppServerError(
          `Codex App Server did not resume session ${options.initialSessionId}.`
        );
      }
      if (resumedId !== options.initialSessionId) {
        throw new CodexAppServerError(
          `Codex App Server returned thread ${resumedId} while resuming ${options.initialSessionId}; refusing to switch sessions.`
        );
      }
      threadId = resumedId;
      attachedToExistingThread = true;
      return threadId;
    }

    const params: Record<string, unknown> = {};
    if (options.cwd !== undefined) {
      params.cwd = options.cwd;
    }
    const result = await request("thread/start", params);
    const thread = isRecord(result) ? result.thread : undefined;
    const startedId = isRecord(thread) ? thread.id : undefined;
    if (typeof startedId !== "string") {
      throw new CodexAppServerError("Codex App Server did not start a thread.");
    }
    threadId = startedId;
    return threadId;
  };

  const send = async (
    message: string
  ): Promise<{ sessionId: string; answer: string }> => {
    if (message.trim() === "") {
      throw new CodexAppServerError("Codex message must not be empty.");
    }
    if (busy) {
      throw new CodexAppServerError(
        "Codex is already responding in this session."
      );
    }
    busy = true;
    try {
      await connect();
      const currentThreadId = await ensureThread();
      const result = await request("turn/start", {
        input: [{ text: message, type: "text" }],
        threadId: currentThreadId,
      });
      const turn = isRecord(result) ? result.turn : undefined;
      const startedTurnId = isRecord(turn) ? turn.id : undefined;
      if (typeof startedTurnId !== "string") {
        throw new CodexAppServerError(
          "Codex App Server did not return a turn ID."
        );
      }
      const completed = createDeferred<{
        sessionId: string;
        answer: string;
      }>();
      const waiter: ActiveTurn = {
        reject: completed.reject,
        resolve: completed.resolve,
        turnId: startedTurnId,
      };
      activeTurn = waiter;

      try {
        if (isRecord(turn) && turn.status !== "inProgress") {
          const turnState = turns.get(startedTurnId) ?? makeTurnState();
          turnState.completedTurn = turn;
          turns.set(startedTurnId, turnState);
        }
        finishActiveTurnIfReady();
        return await completed.promise;
      } catch (error) {
        if (activeTurn === waiter) {
          activeTurn = undefined;
        }
        throw error instanceof Error ? error : new Error(String(error));
      } finally {
        if (activeTurn === waiter) {
          activeTurn = undefined;
        }
        if (waiter.turnId !== undefined) {
          turns.delete(waiter.turnId);
        }
      }
    } finally {
      busy = false;
    }
  };

  const enqueue = async (
    message: string
  ): Promise<{ sessionId: string; completion: Promise<string> }> => {
    if (message.trim() === "") {
      throw new CodexAppServerError("Codex message must not be empty.");
    }
    await connect();
    const currentThreadId = await ensureThread();
    const clientUserMessageId = randomUUID();
    const completion = createDeferred<string>();
    const queuedMessage: QueuedMessage = {
      acknowledged: false,
      clientUserMessageId,
      completion,
    };
    // The queued turn can start before thread/queue/add responds. Register first.
    queuedMessagesByClientId.set(clientUserMessageId, queuedMessage);
    try {
      const result = await request("thread/queue/add", {
        clientUserMessageId,
        input: [{ text: message, type: "text" }],
        threadId: currentThreadId,
      });
      const queuedSubmission = isRecord(result)
        ? result.queuedSubmission
        : undefined;
      if (
        !isRecord(queuedSubmission) ||
        typeof queuedSubmission.id !== "string" ||
        queuedSubmission.clientUserMessageId !== clientUserMessageId
      ) {
        throw new CodexAppServerError(
          "Codex App Server did not acknowledge the queued message with its client ID."
        );
      }
      // Completion notifications can arrive before the queue RPC ACK. Defer
      // settling the public promise until enqueue returns it to the caller.
      acknowledgeQueuedMessage(queuedMessage);
      return { completion: completion.promise, sessionId: currentThreadId };
    } catch (error) {
      queuedMessagesByClientId.delete(clientUserMessageId);
      if (queuedMessage.turnId !== undefined) {
        queuedMessagesByTurnId.delete(queuedMessage.turnId);
      }
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      throw normalizedError;
    }
  };

  const close = async (): Promise<void> => {
    if (closePromise !== undefined) {
      await closePromise;
      return;
    }
    isClosed = true;
    isClosing = true;
    closePromise = (async () => {
      const currentSocket = socket;
      if (
        currentSocket === undefined ||
        currentSocket.readyState === WebSocket.CLOSED
      ) {
        failConnection(makeTransportError("was closed by mdxr."));
        return;
      }
      const closed = once(currentSocket, "close");
      if (currentSocket.readyState === WebSocket.OPEN) {
        currentSocket.close(1000, "mdxr session closed");
      } else {
        currentSocket.terminate();
      }
      await closed;
      failConnection(makeTransportError("was closed by mdxr."));
    })();
    await closePromise;
  };

  return { close, enqueue, send };
};

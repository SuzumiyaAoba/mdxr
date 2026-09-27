import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { connect as connectSocket } from "node:net";
import { homedir } from "node:os";
import path from "node:path";

import { WebSocket } from "ws";
import type { RawData } from "ws";

import { CodexAppServerError } from "./codex-app-server-error.js";
import {
  appendAgentMessageDelta,
  getNotificationTurnId,
  getTurnAnswer,
  getTurnFailureMessage,
  makeTurnState,
  recordCompletedAgentMessage,
} from "./codex-app-server-turn.js";
import type { TurnState } from "./codex-app-server-turn.js";
import { isRecord } from "./guards.js";

const DEFAULT_ENDPOINT = "ws://127.0.0.1:4500";
const DEFAULT_DAEMON_WS_ENDPOINT = "ws://localhost/";
const RPC_TIMEOUT_MS = 30_000;
const MAX_BUFFERED_TURNS = 8;

type RpcId = number | string;
export { CodexAppServerError } from "./codex-app-server-error.js";
export type { CodexAppServerErrorKind } from "./codex-app-server-error.js";

interface PendingRequest {
  method: string;
  reject: (error: Error) => void;
  resolve: (value: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
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
class CodexAppServerSessionClient implements CodexAppServerSession {
  private readonly options: CodexAppServerSessionOptions;
  private readonly endpoint: ResolvedEndpoint;
  private socket: WebSocket | undefined;
  private connectionPromise: Promise<void> | undefined;
  private nextRequestId = 1;
  private threadId: string | undefined;
  private activeTurn: ActiveTurn | undefined;
  private isClosed = false;
  private isClosing = false;
  private closePromise: Promise<void> | undefined;
  private busy = false;
  private attachedToExistingThread: boolean;
  private readonly pendingRequests = new Map<RpcId, PendingRequest>();
  private readonly turns = new Map<string, TurnState>();
  private readonly queuedMessagesByClientId = new Map<string, QueuedMessage>();
  private readonly queuedMessagesByTurnId = new Map<string, QueuedMessage>();

  constructor(options: CodexAppServerSessionOptions) {
    this.options = options;
    this.endpoint = resolveEndpoint(
      options.endpoint,
      options.initialSessionId !== undefined
    );
    this.attachedToExistingThread = options.initialSessionId !== undefined;
  }

  private static makeTransportError(reason: string, cause?: unknown): Error {
    return new CodexAppServerError(
      `Codex App Server connection ${reason}${cause instanceof Error ? `: ${cause.message}` : ""}`,
      "general",
      cause instanceof Error ? { cause } : undefined
    );
  }

  private rejectPendingRequests(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(id);
      pending.reject(error);
    }
  }

  private rejectQueuedMessages(error: Error): void {
    for (const queuedMessage of this.queuedMessagesByClientId.values()) {
      settleQueuedMessage(queuedMessage, { error, type: "reject" });
    }
    this.queuedMessagesByClientId.clear();
    this.queuedMessagesByTurnId.clear();
  }

  private readonly handleSendError = (error?: Error | null): void => {
    if (!(error instanceof Error)) {
      return;
    }
    const wrapped = CodexAppServerSessionClient.makeTransportError(
      "failed while sending a message.",
      error
    );
    this.rejectPendingRequests(wrapped);
    this.activeTurn?.reject(wrapped);
    this.rejectQueuedMessages(wrapped);
  };

  private sendFrame(value: Record<string, unknown>): void {
    const { socket } = this;
    if (socket?.readyState !== WebSocket.OPEN) {
      throw CodexAppServerSessionClient.makeTransportError("is not open.");
    }
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- ws reports asynchronous socket write failures through this callback.
    socket.send(JSON.stringify(value), this.handleSendError);
  }

  private replyToServerRequest(id: RpcId, method: string): void {
    // A resumed thread can have an interactive TUI attached to the same daemon.
    // Approval requests are shared with subscribed clients, so let that UI decide.
    if (this.attachedToExistingThread) {
      return;
    }
    if (
      method === "item/commandExecution/requestApproval" ||
      method === "item/fileChange/requestApproval"
    ) {
      this.sendFrame({ id, result: { decision: "decline" } });
      return;
    }
    if (
      method === "item/tool/requestUserInput" ||
      method === "mcpServer/elicitation/request"
    ) {
      this.sendFrame({ id, result: { action: "decline", content: null } });
      return;
    }
    this.sendFrame({
      error: {
        code: -32_601,
        message: `mdxr does not support the server request ${method}`,
      },
      id,
    });
  }

  private finishActiveTurnIfReady(): void {
    const currentTurn = this.activeTurn;
    if (currentTurn === undefined || currentTurn.turnId === undefined) {
      return;
    }
    const turn = this.turns.get(currentTurn.turnId);
    const completedTurn = turn?.completedTurn;
    if (turn === undefined || completedTurn === undefined) {
      return;
    }

    const failureMessage = getTurnFailureMessage(completedTurn);
    if (failureMessage !== undefined) {
      currentTurn.reject(new CodexAppServerError(failureMessage));
      return;
    }
    const answer = getTurnAnswer(turn);
    if (
      this.threadId === undefined ||
      answer === undefined ||
      answer.text.trim() === ""
    ) {
      currentTurn.reject(new CodexAppServerError("Codex returned no answer."));
      return;
    }
    currentTurn.resolve({ answer: answer.text, sessionId: this.threadId });
  }

  private finishQueuedMessageIfReady(turnId: string, turn: TurnState): void {
    const queuedMessage = this.queuedMessagesByTurnId.get(turnId);
    const { completedTurn } = turn;
    if (queuedMessage === undefined || completedTurn === undefined) {
      return;
    }
    this.queuedMessagesByTurnId.delete(turnId);
    this.queuedMessagesByClientId.delete(queuedMessage.clientUserMessageId);

    const failureMessage = getTurnFailureMessage(completedTurn);
    if (failureMessage !== undefined) {
      settleQueuedMessage(queuedMessage, {
        error: new CodexAppServerError(failureMessage),
        type: "reject",
      });
      return;
    }
    const answer = getTurnAnswer(turn);
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
  }

  private getTurnState(turnId: string): TurnState {
    const existing = this.turns.get(turnId);
    if (existing !== undefined) {
      return existing;
    }
    const created = makeTurnState();
    this.turns.set(turnId, created);
    return created;
  }

  private handleStartedItem(
    turnId: string,
    params: Record<string, unknown>
  ): void {
    const { item } = params;
    if (!isRecord(item) || item.type !== "userMessage") {
      return;
    }
    const { clientId } = item;
    if (typeof clientId !== "string") {
      return;
    }
    const queuedMessage = this.queuedMessagesByClientId.get(clientId);
    if (queuedMessage === undefined) {
      return;
    }
    queuedMessage.turnId = turnId;
    this.queuedMessagesByTurnId.set(turnId, queuedMessage);
  }

  private pruneTurnBuffer(activeTurnId: string): void {
    if (this.turns.size <= MAX_BUFFERED_TURNS) {
      return;
    }
    const oldestTurnId = this.turns.keys().next().value;
    if (oldestTurnId !== undefined && oldestTurnId !== activeTurnId) {
      this.turns.delete(oldestTurnId);
    }
  }

  private handleNotification(message: Record<string, unknown>): void {
    const { method, params } = message;
    if (
      typeof method !== "string" ||
      !isRecord(params) ||
      params.threadId !== this.threadId
    ) {
      return;
    }
    const turnId = getNotificationTurnId(params);
    if (turnId === undefined) {
      return;
    }
    const turn = this.getTurnState(turnId);

    switch (method) {
      case "item/started": {
        this.handleStartedItem(turnId, params);
        break;
      }
      case "item/agentMessage/delta": {
        appendAgentMessageDelta(turn, params);
        break;
      }
      case "item/completed": {
        recordCompletedAgentMessage(turn, params);
        break;
      }
      case "turn/completed": {
        if (isRecord(params.turn)) {
          turn.completedTurn = params.turn;
          this.finishActiveTurnIfReady();
          this.finishQueuedMessageIfReady(turnId, turn);
        }
        break;
      }
      default: {
        break;
      }
    }
    this.pruneTurnBuffer(this.activeTurn?.turnId ?? "");
  }

  private handleResponse(message: Record<string, unknown>): void {
    const { id } = message;
    if (!isRpcId(id)) {
      return;
    }
    const pending = this.pendingRequests.get(id);
    if (pending === undefined) {
      return;
    }
    this.pendingRequests.delete(id);
    clearTimeout(pending.timeout);
    const { error } = message;
    if (isRecord(error)) {
      const messageText =
        typeof error.message === "string"
          ? error.message
          : "Unknown JSON-RPC error";
      const { initialSessionId } = this.options;
      if (
        pending.method === "thread/resume" &&
        initialSessionId !== undefined &&
        isActiveWriterConflict(messageText)
      ) {
        pending.reject(
          new CodexAppServerError(
            `Cannot resume Codex session ${initialSessionId}: another active Codex App Server owns this session. Connect mdxr and the Codex TUI to the same --remote endpoint. The session ID was not changed.`,
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
  }

  private readonly handleMessage = (data: RawData): void => {
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
      this.replyToServerRequest(id, method);
    } else if (isRpcId(id)) {
      this.handleResponse(parsed);
    } else {
      this.handleNotification(parsed);
    }
  };

  private failConnection(error: Error): void {
    this.rejectPendingRequests(error);
    this.activeTurn?.reject(error);
    this.rejectQueuedMessages(error);
  }

  private readonly handleSocketError = (error: Error): void => {
    this.failConnection(
      CodexAppServerSessionClient.makeTransportError("failed.", error)
    );
  };

  private readonly handleSocketClose = (code: number, reason: Buffer): void => {
    if (this.isClosing) {
      return;
    }
    const detail = reason.toString("utf-8");
    const suffix = detail === "" ? "" : `: ${detail}`;
    this.failConnection(
      CodexAppServerSessionClient.makeTransportError(
        `closed unexpectedly (${code}${suffix}).`
      )
    );
  };

  private async request(
    method: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    const id = this.nextRequestId;
    this.nextRequestId += 1;
    const response = createDeferred<unknown>();
    const timeout = setTimeout(() => {
      this.pendingRequests.delete(id);
      response.reject(
        new CodexAppServerError(
          `${method} timed out after ${RPC_TIMEOUT_MS / 1000} seconds.`
        )
      );
    }, RPC_TIMEOUT_MS);
    timeout.unref?.();
    this.pendingRequests.set(id, {
      method,
      reject: response.reject,
      resolve: response.resolve,
      timeout,
    });
    try {
      this.sendFrame({ id, method, params });
    } catch (error) {
      this.pendingRequests.delete(id);
      clearTimeout(timeout);
      response.reject(
        error instanceof Error ? error : new Error(String(error))
      );
    }
    return await response.promise;
  }

  private notify(method: string, params: Record<string, unknown>): void {
    this.sendFrame({ method, params });
  }

  private async initializeConnection(socket: WebSocket): Promise<void> {
    await once(socket, "open");
    await this.request("initialize", {
      capabilities: { experimentalApi: true },
      clientInfo: { name: "mdxr", title: "mdxr", version: "0.7.0" },
    });
    this.notify("initialized", {});
  }

  private async connect(): Promise<void> {
    if (this.isClosed) {
      throw CodexAppServerSessionClient.makeTransportError(
        "was closed by mdxr."
      );
    }
    if (this.connectionPromise !== undefined) {
      await this.connectionPromise;
      return;
    }
    const { socketPath } = this.endpoint;
    const nextSocket = new WebSocket(this.endpoint.url, {
      ...(socketPath === undefined
        ? {}
        : { createConnection: () => connectSocket(socketPath) }),
      perMessageDeflate: false,
    });
    this.socket = nextSocket;
    nextSocket.on("message", this.handleMessage);
    nextSocket.on("error", this.handleSocketError);
    nextSocket.on("close", this.handleSocketClose);
    this.connectionPromise = this.initializeConnection(nextSocket);
    await this.connectionPromise;
  }

  private async ensureThread(): Promise<string> {
    if (this.threadId !== undefined) {
      return this.threadId;
    }
    const { initialSessionId } = this.options;
    if (initialSessionId !== undefined) {
      const result = await this.request("thread/resume", {
        excludeTurns: true,
        threadId: initialSessionId,
      });
      const thread = isRecord(result) ? result.thread : undefined;
      const resumedId = isRecord(thread) ? thread.id : undefined;
      if (typeof resumedId !== "string") {
        throw new CodexAppServerError(
          `Codex App Server did not resume session ${initialSessionId}.`
        );
      }
      if (resumedId !== initialSessionId) {
        throw new CodexAppServerError(
          `Codex App Server returned thread ${resumedId} while resuming ${initialSessionId}; refusing to switch sessions.`
        );
      }
      this.threadId = resumedId;
      this.attachedToExistingThread = true;
      return this.threadId;
    }

    const params: Record<string, unknown> = {};
    if (this.options.cwd !== undefined) {
      params.cwd = this.options.cwd;
    }
    const result = await this.request("thread/start", params);
    const thread = isRecord(result) ? result.thread : undefined;
    const startedId = isRecord(thread) ? thread.id : undefined;
    if (typeof startedId !== "string") {
      throw new CodexAppServerError("Codex App Server did not start a thread.");
    }
    this.threadId = startedId;
    return this.threadId;
  }

  async send(message: string): Promise<{ sessionId: string; answer: string }> {
    if (message.trim() === "") {
      throw new CodexAppServerError("Codex message must not be empty.");
    }
    if (this.busy) {
      throw new CodexAppServerError(
        "Codex is already responding in this session."
      );
    }
    this.busy = true;
    try {
      await this.connect();
      const currentThreadId = await this.ensureThread();
      const result = await this.request("turn/start", {
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
      this.activeTurn = waiter;

      try {
        if (isRecord(turn) && turn.status !== "inProgress") {
          const turnState = this.turns.get(startedTurnId) ?? makeTurnState();
          turnState.completedTurn = turn;
          this.turns.set(startedTurnId, turnState);
        }
        this.finishActiveTurnIfReady();
        return await completed.promise;
      } catch (error) {
        if (this.activeTurn === waiter) {
          this.activeTurn = undefined;
        }
        throw error instanceof Error ? error : new Error(String(error));
      } finally {
        if (this.activeTurn === waiter) {
          this.activeTurn = undefined;
        }
        if (waiter.turnId !== undefined) {
          this.turns.delete(waiter.turnId);
        }
      }
    } finally {
      this.busy = false;
    }
  }

  async enqueue(
    message: string
  ): Promise<{ sessionId: string; completion: Promise<string> }> {
    if (message.trim() === "") {
      throw new CodexAppServerError("Codex message must not be empty.");
    }
    await this.connect();
    const currentThreadId = await this.ensureThread();
    const clientUserMessageId = randomUUID();
    const completion = createDeferred<string>();
    const queuedMessage: QueuedMessage = {
      acknowledged: false,
      clientUserMessageId,
      completion,
    };
    // The queued turn can start before thread/queue/add responds. Register first.
    this.queuedMessagesByClientId.set(clientUserMessageId, queuedMessage);
    try {
      const result = await this.request("thread/queue/add", {
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
      this.queuedMessagesByClientId.delete(clientUserMessageId);
      if (queuedMessage.turnId !== undefined) {
        this.queuedMessagesByTurnId.delete(queuedMessage.turnId);
      }
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      throw normalizedError;
    }
  }

  private async closeSocket(): Promise<void> {
    const currentSocket = this.socket;
    if (
      currentSocket === undefined ||
      currentSocket.readyState === WebSocket.CLOSED
    ) {
      this.failConnection(
        CodexAppServerSessionClient.makeTransportError("was closed by mdxr.")
      );
      return;
    }
    const closed = once(currentSocket, "close");
    if (currentSocket.readyState === WebSocket.OPEN) {
      currentSocket.close(1000, "mdxr session closed");
    } else {
      currentSocket.terminate();
    }
    await closed;
    this.failConnection(
      CodexAppServerSessionClient.makeTransportError("was closed by mdxr.")
    );
  }

  async close(): Promise<void> {
    if (this.closePromise !== undefined) {
      await this.closePromise;
      return;
    }
    this.isClosed = true;
    this.isClosing = true;
    this.closePromise = this.closeSocket();
    await this.closePromise;
  }
}

export const createCodexAppServerSession = (
  options: CodexAppServerSessionOptions = {}
): CodexAppServerSession => {
  const client = new CodexAppServerSessionClient(options);
  return {
    close: client.close.bind(client),
    enqueue: client.enqueue.bind(client),
    send: client.send.bind(client),
  };
};

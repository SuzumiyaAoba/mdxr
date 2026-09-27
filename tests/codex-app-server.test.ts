import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCodexAppServerSession } from "../src/codex-app-server.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const mockState = vi.hoisted(() => ({
  connectionOptions: [] as {
    hasCreateConnection: boolean;
    perMessageDeflate: boolean;
  }[],
  messages: [] as Record<string, unknown>[],
  onSend: undefined as
    | ((
        socket: { emit: (event: string, ...args: unknown[]) => void },
        message: Record<string, unknown>
      ) => void)
    | undefined,
  urls: [] as string[],
}));

vi.mock(import("ws"), async (importOriginal) => {
  type Listener = (...args: unknown[]) => void;
  class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    readyState = MockWebSocket.CONNECTING;
    private readonly listeners = new Map<
      string,
      { listener: Listener; once: boolean }[]
    >();

    constructor(
      url: string,
      options?: {
        createConnection?: () => unknown;
        perMessageDeflate?: boolean;
      }
    ) {
      mockState.urls.push(url);
      mockState.connectionOptions.push({
        hasCreateConnection: typeof options?.createConnection === "function",
        perMessageDeflate: options?.perMessageDeflate ?? false,
      });
      queueMicrotask(() => {
        this.readyState = MockWebSocket.OPEN;
        this.emit("open");
      });
    }

    on(event: string, listener: Listener): this {
      const listeners = this.listeners.get(event) ?? [];
      listeners.push({ listener, once: false });
      this.listeners.set(event, listeners);
      return this;
    }

    once(event: string, listener: Listener): this {
      const listeners = this.listeners.get(event) ?? [];
      listeners.push({ listener, once: true });
      this.listeners.set(event, listeners);
      return this;
    }

    emit(event: string, ...args: unknown[]): void {
      const listeners = this.listeners.get(event) ?? [];
      // oxlint-disable-next-line unicorn/no-useless-spread -- Snapshot prevents once-listener removal from skipping the next listener.
      for (const entry of [...listeners]) {
        if (entry.once) {
          this.off(event, entry.listener);
        }
        entry.listener(...args);
      }
    }

    off(event: string, listener: Listener): this {
      const listeners = this.listeners.get(event) ?? [];
      this.listeners.set(
        event,
        listeners.filter((entry) => entry.listener !== listener)
      );
      return this;
    }

    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- Mirrors the ws callback API used by the client.
    send(data: string, callback?: (error?: Error | null) => void): void {
      const parsed: unknown = JSON.parse(data);
      if (!isRecord(parsed)) {
        return;
      }
      const message = parsed;
      mockState.messages.push(message);
      mockState.onSend?.(this, message);
      // oxlint-disable-next-line promise/prefer-await-to-callbacks -- The ws send API reports write completion through a callback.
      callback?.(null);
    }

    close(): void {
      this.readyState = MockWebSocket.CLOSING;
      queueMicrotask(() => {
        this.readyState = MockWebSocket.CLOSED;
        this.emit("close", 1000, Buffer.alloc(0));
      });
    }

    terminate(): void {
      this.readyState = MockWebSocket.CLOSED;
      queueMicrotask(() => {
        this.emit("close", 1006, Buffer.alloc(0));
      });
    }
  }

  const actual = await importOriginal();
  return {
    ...actual,
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- This mock implements the ws client methods exercised by this suite.
    WebSocket: MockWebSocket as unknown as typeof actual.WebSocket,
  };
});

interface TestSocket {
  emit: (event: string, ...args: unknown[]) => void;
}

const respond = (
  socket: TestSocket,
  id: unknown,
  result: Record<string, unknown>
): void => {
  socket.emit("message", Buffer.from(JSON.stringify({ id, result })), false);
};

const notify = (
  socket: TestSocket,
  method: string,
  params: Record<string, unknown>
): void => {
  socket.emit(
    "message",
    Buffer.from(JSON.stringify({ method, params })),
    false
  );
};

const methodsSent = (): string[] =>
  mockState.messages.flatMap((message) =>
    typeof message.method === "string" ? [message.method] : []
  );

const defaultRpcHandler = (
  socket: TestSocket,
  message: Record<string, unknown>
): void => {
  if (typeof message.method !== "string") {
    return;
  }
  const { id } = message;
  switch (message.method) {
    case "initialize": {
      respond(socket, id, { serverInfo: { name: "codex-app-server" } });
      return;
    }
    case "thread/start": {
      respond(socket, id, { thread: { id: "new-thread" } });
      return;
    }
    case "thread/resume": {
      respond(socket, id, { thread: { id: "existing-thread" } });
      return;
    }
    case "turn/start": {
      const turnId = `turn-${methodsSent().filter((method) => method === "turn/start").length}`;
      const params = isRecord(message.params) ? message.params : undefined;
      const threadId =
        typeof params?.threadId === "string" ? params.threadId : undefined;
      if (threadId === undefined) {
        return;
      }
      notify(socket, "item/agentMessage/delta", {
        delta: "Answer from Codex",
        itemId: "assistant-item",
        threadId,
        turnId,
      });
      notify(socket, "turn/completed", {
        threadId,
        turn: { id: turnId, status: "completed" },
      });
      respond(socket, id, { turn: { id: turnId, status: "inProgress" } });
      break;
    }
    default: {
      break;
    }
  }
};

describe("Codex App Server client", () => {
  beforeEach(() => {
    mockState.messages.length = 0;
    mockState.connectionOptions.length = 0;
    mockState.urls.length = 0;
    mockState.onSend = defaultRpcHandler;
  });

  it("starts a thread, streams its answer, and reuses the same connection", async () => {
    const session = createCodexAppServerSession({
      cwd: "/project",
      endpoint: "ws://127.0.0.1:4500",
    });

    await expect(session.send("First question")).resolves.toStrictEqual({
      answer: "Answer from Codex",
      sessionId: "new-thread",
    });
    await expect(session.send("Second question")).resolves.toStrictEqual({
      answer: "Answer from Codex",
      sessionId: "new-thread",
    });

    expect({
      methods: methodsSent(),
      threadStart: mockState.messages.find(
        (message) => message.method === "thread/start"
      ),
      turns: mockState.messages.filter(
        (message) => message.method === "turn/start"
      ),
      urls: mockState.urls,
    }).toStrictEqual({
      methods: [
        "initialize",
        "initialized",
        "thread/start",
        "turn/start",
        "turn/start",
      ],
      threadStart: {
        id: 2,
        method: "thread/start",
        params: { cwd: "/project" },
      },
      turns: [
        {
          id: 3,
          method: "turn/start",
          params: {
            input: [{ text: "First question", type: "text" }],
            threadId: "new-thread",
          },
        },
        {
          id: 4,
          method: "turn/start",
          params: {
            input: [{ text: "Second question", type: "text" }],
            threadId: "new-thread",
          },
        },
      ],
      urls: ["ws://127.0.0.1:4500"],
    });

    await session.close();
  });

  it("queues on a Unix daemon socket and correlates the completed answer", async () => {
    mockState.onSend = (socket, message) => {
      if (message.method === "initialize") {
        respond(socket, message.id, {});
        return;
      }
      if (message.method === "thread/resume") {
        respond(socket, message.id, { thread: { id: "existing-thread" } });
        // The active TUI handles approvals for this shared thread.
        socket.emit(
          "message",
          Buffer.from(
            JSON.stringify({
              id: "pending-approval",
              method: "item/commandExecution/requestApproval",
              params: { threadId: "existing-thread" },
            })
          ),
          false
        );
        return;
      }
      if (message.method === "thread/queue/add") {
        const params = isRecord(message.params) ? message.params : undefined;
        const clientUserMessageId = params?.clientUserMessageId;
        if (typeof clientUserMessageId !== "string") {
          return;
        }
        // Queue dispatch can produce notifications before the RPC ACK arrives.
        notify(socket, "item/started", {
          item: {
            clientId: clientUserMessageId,
            content: [{ text: "A queued question", type: "text" }],
            id: "queued-user-item",
            type: "userMessage",
          },
          threadId: "existing-thread",
          turnId: "queued-turn",
        });
        notify(socket, "item/agentMessage/delta", {
          delta: "Queued answer",
          itemId: "queued-answer-item",
          threadId: "existing-thread",
          turnId: "queued-turn",
        });
        notify(socket, "item/completed", {
          item: {
            id: "queued-answer-item",
            phase: "final_answer",
            text: "Queued answer",
            type: "agentMessage",
          },
          threadId: "existing-thread",
          turnId: "queued-turn",
        });
        notify(socket, "turn/completed", {
          threadId: "existing-thread",
          turn: { id: "queued-turn", status: "completed" },
        });
        respond(socket, message.id, {
          queuedSubmission: {
            clientUserMessageId,
            id: "queue-submission-1",
            input: [{ text: "A queued question", type: "text" }],
          },
        });
      }
    };
    const session = createCodexAppServerSession({
      endpoint: "unix:///private/tmp/codex-app-server.sock",
      initialSessionId: "existing-thread",
    });

    const queued = await session.enqueue("A queued question");
    await expect(queued.completion).resolves.toBe("Queued answer");

    const queueRequest = mockState.messages.find(
      (message) => message.method === "thread/queue/add"
    );
    const initializeRequest = mockState.messages.find(
      (message) => message.method === "initialize"
    );
    const resumeRequest = mockState.messages.find(
      (message) => message.method === "thread/resume"
    );
    expect({
      acknowledgement: queueRequest,
      approvalReplies: mockState.messages.filter(
        (message) => message.id === "pending-approval"
      ),
      initialize: initializeRequest,
      methods: methodsSent(),
      queuedSessionId: queued.sessionId,
      resume: resumeRequest,
      socketUrl: mockState.urls,
      transport: mockState.connectionOptions,
    }).toMatchObject({
      approvalReplies: [],
      initialize: {
        method: "initialize",
        params: {
          capabilities: { experimentalApi: true },
        },
      },
      methods: [
        "initialize",
        "initialized",
        "thread/resume",
        "thread/queue/add",
      ],
      queuedSessionId: "existing-thread",
      resume: {
        method: "thread/resume",
        params: { excludeTurns: true, threadId: "existing-thread" },
      },
      socketUrl: ["ws://localhost/"],
      transport: [{ hasCreateConnection: true, perMessageDeflate: false }],
    });
    expect(queueRequest).toMatchObject({
      method: "thread/queue/add",
      params: {
        input: [{ text: "A queued question", type: "text" }],
        threadId: "existing-thread",
      },
    });
    expect(
      mockState.messages.find((message) => message.method === "turn/start")
    ).toBeUndefined();

    await session.close();
  });

  it("resumes the exact existing thread and reads a completed agent message", async () => {
    mockState.onSend = (socket, message) => {
      if (message.method === "initialize") {
        respond(socket, message.id, {});
        return;
      }
      if (message.method === "thread/resume") {
        respond(socket, message.id, { thread: { id: "existing-thread" } });
        return;
      }
      if (message.method === "turn/start") {
        notify(socket, "item/completed", {
          item: {
            id: "answer-item",
            phase: "final_answer",
            text: "Resumed answer",
            type: "agentMessage",
          },
          threadId: "existing-thread",
          turnId: "resume-turn",
        });
        notify(socket, "turn/completed", {
          threadId: "existing-thread",
          turn: { id: "resume-turn", status: "completed" },
        });
        respond(socket, message.id, {
          turn: { id: "resume-turn", status: "inProgress" },
        });
      }
    };
    const session = createCodexAppServerSession({
      endpoint: "ws://127.0.0.1:4500",
      initialSessionId: "existing-thread",
    });

    await expect(session.send("Continue this thread")).resolves.toStrictEqual({
      answer: "Resumed answer",
      sessionId: "existing-thread",
    });
    expect(methodsSent()).toContain("thread/resume");
    expect(methodsSent()).not.toContain("thread/start");
    expect(
      mockState.messages.find((message) => message.method === "thread/resume")
    ).toStrictEqual({
      id: 2,
      method: "thread/resume",
      params: { excludeTurns: true, threadId: "existing-thread" },
    });

    await session.close();
  });

  it("reports an active writer conflict without starting another thread", async () => {
    mockState.onSend = (socket, message) => {
      if (message.method === "initialize") {
        respond(socket, message.id, {});
      }
      if (message.method === "thread/resume") {
        socket.emit(
          "message",
          Buffer.from(
            JSON.stringify({
              error: {
                code: -32_000,
                message:
                  "thread-store conflict: session already has an active writer",
              },
              id: message.id,
            })
          ),
          false
        );
      }
    };
    const session = createCodexAppServerSession({
      endpoint: "ws://127.0.0.1:4500",
      initialSessionId: "owned-thread",
    });

    await expect(session.send("Do not switch threads")).rejects.toMatchObject({
      kind: "session-conflict",
    });
    expect(methodsSent()).toContain("thread/resume");
    expect(methodsSent()).not.toContain("thread/start");
    expect(methodsSent()).not.toContain("turn/start");

    await session.close();
  });

  it("declines approval requests explicitly so the turn cannot hang", async () => {
    mockState.onSend = (socket, message) => {
      if (message.method === "initialize") {
        respond(socket, message.id, {});
        return;
      }
      if (message.method === "thread/start") {
        respond(socket, message.id, { thread: { id: "new-thread" } });
        return;
      }
      if (message.method === "turn/start") {
        socket.emit(
          "message",
          Buffer.from(
            JSON.stringify({
              id: "approval-request",
              method: "item/commandExecution/requestApproval",
              params: { threadId: "new-thread" },
            })
          ),
          false
        );
        notify(socket, "item/agentMessage/delta", {
          delta: "The requested action was declined.",
          itemId: "assistant-item",
          threadId: "new-thread",
          turnId: "approval-turn",
        });
        notify(socket, "turn/completed", {
          threadId: "new-thread",
          turn: { id: "approval-turn", status: "completed" },
        });
        respond(socket, message.id, {
          turn: { id: "approval-turn", status: "inProgress" },
        });
      }
    };
    const session = createCodexAppServerSession({
      endpoint: "ws://127.0.0.1:4500",
    });

    await expect(session.send("Run a command")).resolves.toStrictEqual({
      answer: "The requested action was declined.",
      sessionId: "new-thread",
    });
    expect(mockState.messages).toContainEqual({
      id: "approval-request",
      result: { decision: "decline" },
    });

    await session.close();
  });

  it("refuses a mismatched resume response instead of switching threads", async () => {
    mockState.onSend = (socket, message) => {
      if (message.method === "initialize") {
        respond(socket, message.id, {});
      }
      if (message.method === "thread/resume") {
        respond(socket, message.id, { thread: { id: "different-thread" } });
      }
    };
    const session = createCodexAppServerSession({
      endpoint: "ws://127.0.0.1:4500",
      initialSessionId: "requested-thread",
    });

    await expect(session.send("Stay on this thread")).rejects.toThrow(
      "refusing to switch sessions"
    );
    expect(methodsSent()).not.toContain("thread/start");
    expect(methodsSent()).not.toContain("turn/start");

    await session.close();
  });
});

import { randomUUID } from "node:crypto";
import path from "node:path";

import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  SDKMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";

export interface ClaudeStreamSession {
  send: (message: string) => Promise<{ sessionId: string; answer: string }>;
  close: () => Promise<void>;
}

interface PendingTurn {
  reject: (error: Error) => void;
  resolve: (value: { sessionId: string; answer: string }) => void;
  uuid: string;
}

class UserMessageQueue implements AsyncIterableIterator<SDKUserMessage> {
  private readonly messages: SDKUserMessage[] = [];
  private readonly readers: ((
    result: IteratorResult<SDKUserMessage>
  ) => void)[] = [];
  private closed = false;

  [Symbol.asyncIterator](): AsyncIterableIterator<SDKUserMessage> {
    return this;
  }

  close(): void {
    this.closed = true;
    for (const reader of this.readers.splice(0)) {
      reader({ done: true, value: undefined });
    }
  }

  async next(): Promise<IteratorResult<SDKUserMessage>> {
    const message = this.messages.shift();
    if (message !== undefined) {
      return { done: false, value: message };
    }
    if (this.closed) {
      return { done: true, value: undefined };
    }
    // A pending reader is the queue's backpressure mechanism.
    // oxlint-disable-next-line promise/avoid-new -- AsyncIterableIterator needs a pending next() promise.
    const result = await new Promise<IteratorResult<SDKUserMessage>>(
      (resolve) => {
        this.readers.push(resolve);
      }
    );
    return result;
  }

  push(message: SDKUserMessage): void {
    if (this.closed) {
      throw new Error("Claude Agent SDK input is closed");
    }
    const reader = this.readers.shift();
    if (reader === undefined) {
      this.messages.push(message);
      return;
    }
    reader({ done: false, value: message });
  }
}

const asError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const noApprovalError = (tools: string[]): Error =>
  new Error(
    `Claude Code denied ${tools.join(", ")} because the MDX preview has no tool approval UI.`
  );

/**
 * Create an MDX-owned, long-lived Claude Agent SDK session for `cwd`.
 * This starts a new session; it cannot attach to an already-running Claude CLI.
 */
export const createClaudeStreamSession = (cwd: string): ClaudeStreamSession => {
  const absoluteCwd = path.resolve(cwd);
  const input = new UserMessageQueue();
  let activeTurn: PendingTurn | undefined;
  let failure: Error | undefined;
  let closed = false;
  let sessionId: string | undefined;
  let abortController: AbortController | undefined;
  let runner: Promise<void> | undefined;

  const finishTurn = (
    turn: PendingTurn,
    result: { sessionId: string; answer: string }
  ): void => {
    if (activeTurn === turn) {
      activeTurn = undefined;
    }
    turn.resolve(result);
  };

  const failTurn = (turn: PendingTurn, error: Error): void => {
    if (activeTurn === turn) {
      activeTurn = undefined;
    }
    turn.reject(error);
  };

  const failSession = (error: unknown): void => {
    if (failure !== undefined || closed) {
      return;
    }
    failure = asError(error);
    input.close();
    abortController?.abort();
    if (activeTurn !== undefined) {
      failTurn(activeTurn, failure);
    }
  };

  const handleMessage = (message: SDKMessage): void => {
    if (message.type === "system" && message.subtype === "init") {
      sessionId = message.session_id;
      return;
    }
    if (message.type !== "result") {
      return;
    }

    sessionId = message.session_id;
    const turn = activeTurn;
    if (turn === undefined) {
      return;
    }
    const resultUserIds = message.user_message_uuids ?? [];
    const hasMatchingUserMessage =
      message.user_message_uuid === undefined ||
      message.user_message_uuid === turn.uuid ||
      resultUserIds.includes(turn.uuid);
    if (!hasMatchingUserMessage) {
      return;
    }

    if (message.permission_denials.length > 0) {
      const deniedTools = [
        ...new Set(
          message.permission_denials.map((denial) => denial.tool_name)
        ),
      ];
      failTurn(turn, noApprovalError(deniedTools));
      return;
    }

    if (message.subtype !== "success") {
      failTurn(
        turn,
        new Error(
          `Claude Agent SDK turn failed (${message.subtype}): ${message.errors.join("; ")}`
        )
      );
      return;
    }

    if (message.is_error) {
      failTurn(
        turn,
        new Error(`Claude Code returned an error: ${message.result}`)
      );
      return;
    }

    if (sessionId === undefined || sessionId === "") {
      failTurn(
        turn,
        new Error("Claude Agent SDK did not provide a session ID")
      );
      return;
    }
    finishTurn(turn, { answer: message.result, sessionId });
  };

  const start = (): void => {
    if (runner !== undefined || failure !== undefined || closed) {
      return;
    }
    abortController = new AbortController();
    try {
      const stream = query({
        options: {
          abortController,
          cwd: absoluteCwd,
          permissionMode: "dontAsk",
        },
        prompt: input,
      });
      runner = (async () => {
        try {
          for await (const message of stream) {
            handleMessage(message);
          }
          if (!closed) {
            throw new Error("Claude Agent SDK session ended unexpectedly");
          }
        } catch (error) {
          failSession(error);
        }
      })();
    } catch (error) {
      failSession(error);
    }
  };

  const sendOne = async (
    message: string
  ): Promise<{ sessionId: string; answer: string }> => {
    if (closed) {
      throw new Error("Claude Agent SDK session is closed");
    }
    if (failure !== undefined) {
      throw failure;
    }
    if (activeTurn !== undefined) {
      throw new Error("Claude Agent SDK is already responding");
    }
    if (message.trim() === "") {
      throw new Error("Message must not be empty");
    }

    const uuid = randomUUID();
    // Each send waits for its matching SDK result event.
    // oxlint-disable-next-line promise/avoid-new -- The SDK stream resolves this deferred turn asynchronously.
    const result = await new Promise<{ sessionId: string; answer: string }>(
      (resolve, reject) => {
        const turn = { reject, resolve, uuid };
        activeTurn = turn;
        start();
        if (failure === undefined) {
          try {
            input.push({
              message: { content: message, role: "user" },
              parent_tool_use_id: null,
              type: "user",
              uuid,
            });
          } catch (error) {
            failTurn(turn, asError(error));
          }
        }
      }
    );
    return result;
  };

  const close = async (): Promise<void> => {
    if (!closed) {
      closed = true;
      input.close();
      abortController?.abort();
      if (activeTurn !== undefined) {
        failTurn(activeTurn, new Error("Claude Agent SDK session was closed"));
      }
    }
    await runner;
  };

  return { close, send: sendOne };
};

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Query, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createClaudeStreamSession } from "../src/claude-stream-session.js";

const mockQuery = vi.hoisted(() =>
  vi.fn<(params: Parameters<typeof query>[0]) => Query>()
);

vi.mock(import("@anthropic-ai/claude-agent-sdk"), () => ({
  query: mockQuery,
}));

const SESSION_ID = "claude-sdk-session-1";

const makeQuery = (
  prompt: Parameters<typeof query>[0]["prompt"],
  deniedTool?: string,
  onInput?: (message: SDKUserMessage) => void
): Query => {
  const stream = (async function* stream() {
    if (typeof prompt === "string") {
      throw new TypeError("Expected streaming input");
    }
    for await (const userMessage of prompt) {
      onInput?.(userMessage);
      const { content } = userMessage.message;
      if (typeof content !== "string") {
        throw new TypeError("Expected a text prompt");
      }
      yield {
        is_error: false,
        permission_denials:
          deniedTool === undefined
            ? []
            : [
                {
                  tool_input: {},
                  tool_name: deniedTool,
                  tool_use_id: "tool-use-1",
                },
              ],
        result: `Answer to ${content}`,
        session_id: SESSION_ID,
        subtype: "success",
        type: "result",
        user_message_uuid: userMessage.uuid,
      };
    }
  })();
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Test double implements the async iteration surface consumed by this adapter.
  return stream as unknown as Query;
};

describe("Claude Agent SDK streaming sessions", () => {
  afterEach(() => {
    mockQuery.mockReset();
  });

  it("sends multiple messages through one session and one SDK process", async () => {
    const sent: string[] = [];
    let capturedOptions: Parameters<typeof query>[0]["options"] | undefined;
    mockQuery.mockImplementation(
      ({ options, prompt }: Parameters<typeof query>[0]) => {
        capturedOptions = options;
        return makeQuery(prompt, undefined, (message) => {
          if (typeof message.message.content === "string") {
            sent.push(message.message.content);
          }
        });
      }
    );

    const session = createClaudeStreamSession("/workspace/project");
    await expect(session.send("First question")).resolves.toStrictEqual({
      answer: "Answer to First question",
      sessionId: SESSION_ID,
    });
    await expect(session.send("Second question")).resolves.toStrictEqual({
      answer: "Answer to Second question",
      sessionId: SESSION_ID,
    });

    expect(query).toHaveBeenCalledOnce();
    expect(capturedOptions).toMatchObject({
      cwd: "/workspace/project",
      permissionMode: "dontAsk",
    });
    expect(sent).toStrictEqual(["First question", "Second question"]);
    await session.close();
  });

  it("reports tool denials because the preview cannot ask for approval", async () => {
    mockQuery.mockImplementation(({ prompt }: Parameters<typeof query>[0]) =>
      makeQuery(prompt, "Bash")
    );
    const session = createClaudeStreamSession("/workspace/project");

    await expect(session.send("Run a command")).rejects.toThrow(
      "Claude Code denied Bash because the MDX preview has no tool approval UI."
    );
    await session.close();
  });
});

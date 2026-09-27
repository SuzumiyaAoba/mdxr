import { once } from "node:events";
import fs from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentMessage, AgentProvider } from "../src/agent-session.js";
import { createAgentSession as createAgentSessionMock } from "../src/agent-session.js";
import { render, renderFile } from "../src/render.js";
import { serve } from "../src/serve.js";

type AgentSession = ReturnType<typeof createAgentSessionMock>;

const historyBody = async (
  response: Response
): Promise<{ latestId: string; versions: unknown[] }> => {
  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("latestId" in body) ||
    typeof body.latestId !== "string" ||
    !("versions" in body) ||
    !Array.isArray(body.versions)
  ) {
    throw new TypeError("Invalid history response");
  }
  return { latestId: body.latestId, versions: body.versions as unknown[] };
};

vi.mock(import("../src/render.js"), () => ({
  render: vi.fn<typeof render>(),
  renderFile: vi.fn<typeof renderFile>(),
}));

vi.mock(import("../src/agent-session.js"), () => ({
  createAgentSession: vi.fn<typeof createAgentSessionMock>(),
}));

describe("preview agent API", () => {
  let dir: string;
  let filePath: string;
  let server: Server | undefined;
  let activeProvider: AgentProvider;
  let sendAgentMessage: AgentSession["send"];
  let closeAgentSession: AgentSession["close"];

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-agent-"));
    filePath = path.join(dir, "document.mdx");
    await writeFile(filePath, "# Agent preview\n");
    vi.mocked(render).mockReset().mockResolvedValue("historical preview");
    vi.mocked(renderFile).mockReset().mockResolvedValue("preview");
    vi.mocked(createAgentSessionMock).mockReset();
    activeProvider = "codex";
    sendAgentMessage = vi.fn<AgentSession["send"]>().mockImplementation(
      async (message) =>
        await Promise.resolve({
          busy: false,
          messages: [
            { content: message, role: "user" },
            { content: "agent answer", role: "assistant" },
          ],
          provider: activeProvider,
          sessionId: "session-123",
        })
    );
    closeAgentSession = vi.fn<AgentSession["close"]>().mockResolvedValue();
    vi.mocked(createAgentSessionMock).mockImplementation(
      (_file, provider, _sessionId, _serverEndpoint) => {
        activeProvider = provider;
        return {
          close: closeAgentSession,
          current: vi.fn<AgentSession["current"]>().mockResolvedValue({
            busy: false,
            messages: [] as AgentMessage[],
            provider,
            sessionId: undefined,
          }),
          send: sendAgentMessage,
          setOnUpdate: vi.fn<AgentSession["setOnUpdate"]>(),
        };
      }
    );
  });

  const closeServer = async (): Promise<void> => {
    const currentServer = server;
    if (currentServer?.listening === true) {
      currentServer.close();
      await once(currentServer, "close");
    }
    server = undefined;
  };

  afterEach(async () => {
    vi.useRealTimers();
    await closeServer();
    vi.restoreAllMocks();
    await rm(dir, { force: true, recursive: true });
  });

  const startServer = async (
    agent?: AgentProvider,
    session?: string,
    serverEndpoint?: string
  ): Promise<string> => {
    const options: {
      agent?: AgentProvider;
      session?: string;
      server?: string;
    } = {};
    if (agent !== undefined) {
      options.agent = agent;
    }
    if (session !== undefined) {
      options.session = session;
    }
    if (serverEndpoint !== undefined) {
      options.server = serverEndpoint;
    }
    server = await serve(filePath, 0, options);
    const address = server.address();
    if (typeof address !== "object" || address === null) {
      throw new Error("preview server is not listening");
    }
    return `http://127.0.0.1:${address.port}`;
  };

  it("injects chat and forwards Codex connection options", async () => {
    const disabledUrl = await startServer();
    const disabledResponse = await fetch(`${disabledUrl}/`);
    const disabledHtml = await disabledResponse.text();
    expect(disabledHtml).not.toContain("data-mdxr-agent");
    await closeServer();

    const enabledUrl = await startServer(
      "codex",
      "selected-session",
      "ws://127.0.0.1:4500"
    );
    const enabledResponse = await fetch(`${enabledUrl}/`);
    const enabledHtml = await enabledResponse.text();
    expect(enabledHtml).toContain("data-mdxr-agent");
    expect(createAgentSessionMock).toHaveBeenCalledWith(
      filePath,
      "codex",
      "selected-session",
      "ws://127.0.0.1:4500"
    );
    await closeServer();
    expect(closeAgentSession).toHaveBeenCalledOnce();
  });

  it("rejects an existing Claude session ID", async () => {
    await expect(
      serve(filePath, 0, { agent: "claude", session: "claude-session" })
    ).rejects.toThrow("--session is only supported for codex");
    expect(createAgentSessionMock).not.toHaveBeenCalled();
  });

  it("rejects a shared App Server endpoint for Claude", async () => {
    await expect(
      serve(filePath, 0, {
        agent: "claude",
        server: "ws://127.0.0.1:4500",
      })
    ).rejects.toThrow("--server requires --agent codex");
    expect(createAgentSessionMock).not.toHaveBeenCalled();
  });

  it("returns the selected provider and an empty session on GET", async () => {
    const baseUrl = await startServer("codex");
    const response = await fetch(`${baseUrl}/__mdxr_agent`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toMatchObject({
      busy: false,
      messages: [],
      provider: "codex",
      sessionId: null,
    });
  });

  it("returns the agent answer and updated conversation on POST", async () => {
    const baseUrl = await startServer("codex");
    const message = "# What changed?\n\n**A bold note.**";
    const response = await fetch(`${baseUrl}/__mdxr_agent`, {
      body: JSON.stringify({ message }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      busy: false,
      messages: [
        {
          content: message,
          html: "<h1>What changed?</h1><p><strong>A bold note.</strong></p>",
          role: "user",
        },
        { content: "agent answer", role: "assistant" },
      ],
      provider: "codex",
      sessionId: "session-123",
    });
    expect(sendAgentMessage).toHaveBeenCalledWith(message);
  });

  it("accepts case-insensitive JSON media types and preserves message whitespace", async () => {
    const baseUrl = await startServer("codex");
    const message = "  Keep this indentation.\n  And these trailing spaces.  ";
    const response = await fetch(`${baseUrl}/__mdxr_agent`, {
      body: JSON.stringify({ message }),
      headers: { "content-type": "Application/JSON; charset=UTF-8" },
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(sendAgentMessage).toHaveBeenCalledWith(message);
  });

  it("rejects a JSON-like but unsupported media type", async () => {
    const baseUrl = await startServer("codex");
    const response = await fetch(`${baseUrl}/__mdxr_agent`, {
      body: JSON.stringify({ message: "Do this" }),
      headers: { "content-type": "application/jsonp" },
      method: "POST",
    });

    expect(response.status).toBe(400);
    expect(sendAgentMessage).not.toHaveBeenCalled();
  });

  it("advertises allowed methods when an API route receives an unsupported method", async () => {
    const baseUrl = await startServer("codex");
    const [agentResponse, historyResponse] = await Promise.all([
      fetch(`${baseUrl}/__mdxr_agent`, { method: "PUT" }),
      fetch(`${baseUrl}/__mdxr_history`, { method: "PUT" }),
    ]);

    expect({
      agentAllow: agentResponse.headers.get("allow"),
      agentStatus: agentResponse.status,
      historyAllow: historyResponse.headers.get("allow"),
      historyStatus: historyResponse.status,
    }).toStrictEqual({
      agentAllow: "GET, POST",
      agentStatus: 405,
      historyAllow: "GET",
      historyStatus: 405,
    });
  });

  it("does not expose the agent API unless a provider is selected", async () => {
    const baseUrl = await startServer();
    const response = await fetch(`${baseUrl}/__mdxr_agent`);

    expect(response.status).toBe(404);
    expect(createAgentSessionMock).not.toHaveBeenCalled();
  });

  it("rejects cross-origin messages before starting an agent turn", async () => {
    const baseUrl = await startServer("codex");
    const response = await fetch(`${baseUrl}/__mdxr_agent`, {
      body: JSON.stringify({ message: "Do this" }),
      headers: {
        "content-type": "application/json",
        origin: "https://attacker.example",
      },
      method: "POST",
    });

    expect(response.status).toBe(403);
    expect(sendAgentMessage).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and invalid message values", async () => {
    const baseUrl = await startServer("codex");
    const bodies = ["{", JSON.stringify({ message: 42 }), JSON.stringify({})];

    const responses = await Promise.all(
      bodies.map(
        async (body) =>
          await fetch(`${baseUrl}/__mdxr_agent`, {
            body,
            headers: { "content-type": "application/json" },
            method: "POST",
          })
      )
    );
    expect(responses.map((response) => response.status)).toStrictEqual([
      400, 400, 400,
    ]);
    expect(sendAgentMessage).not.toHaveBeenCalled();
  });

  it("ignores session-store watcher events while still watching the document", async () => {
    // This test manually calls the captured callback; leave OS watcher events
    // out so history-store writes cannot race with that controlled sequence.
    const originalWatch = fs.watch.bind(fs);
    const watch = vi.spyOn(fs, "watch").mockImplementation((...args) => {
      const watcher = originalWatch(...args);
      watcher.close();
      return watcher;
    });
    const baseUrl = await startServer("codex");
    expect(baseUrl).toContain("127.0.0.1");
    const listener = watch.mock.calls[0]?.at(-1);
    if (typeof listener !== "function") {
      throw new TypeError("preview watcher was not installed");
    }

    vi.useFakeTimers();
    listener("change", path.join(".mdxr", "sessions.json"));
    await vi.advanceTimersByTimeAsync(100);
    expect(renderFile).toHaveBeenCalledOnce();

    listener("change", "document.mdx");
    await vi.advanceTimersByTimeAsync(100);
    vi.useRealTimers();
    await vi.waitFor(() => {
      expect(renderFile).toHaveBeenCalledTimes(2);
    });
  });

  it("keeps local MDX versions and serves source and diff views", async () => {
    const watch = vi.spyOn(fs, "watch");
    const baseUrl = await startServer();
    const initialResponse = await fetch(`${baseUrl}/__mdxr_history`);
    const initial = await historyBody(initialResponse);
    expect(initial.versions).toHaveLength(1);
    expect(initial.versions[0]).toMatchObject({ kind: "initial" });

    await writeFile(filePath, "# Revised document\n");
    const listener = watch.mock.calls[0]?.at(-1);
    if (typeof listener !== "function") {
      throw new TypeError("preview watcher was not installed");
    }
    listener("change", "document.mdx");

    let latestId = "";
    await vi.waitFor(async () => {
      const response = await fetch(`${baseUrl}/__mdxr_history`);
      const body = await historyBody(response);
      expect(body.versions).toHaveLength(2);
      ({ latestId } = body);
    });

    const sourceResponse = await fetch(
      `${baseUrl}/__mdxr_history?view=source&id=${latestId}`
    );
    /* oxlint-disable typescript/no-unsafe-assignment -- Vitest asymmetric matchers are typed as any. */
    await expect(sourceResponse.json()).resolves.toMatchObject({
      id: latestId,
      source: "# Revised document\n",
      syntax: expect.arrayContaining([
        expect.arrayContaining([
          expect.objectContaining({
            style: expect.objectContaining({
              "--shiki-dark": expect.any(String),
              "--shiki-light": expect.any(String),
            }),
          }),
        ]),
      ]),
    });
    /* oxlint-enable typescript/no-unsafe-assignment */
    const diffResponse = await fetch(
      `${baseUrl}/__mdxr_history?view=diff&from=${initial.latestId}&to=${latestId}`
    );
    /* oxlint-disable typescript/no-unsafe-assignment -- Vitest asymmetric matchers are typed as any. */
    await expect(diffResponse.json()).resolves.toMatchObject({
      lines: [
        { text: "# Agent preview", type: "remove" },
        { text: "# Revised document", type: "add" },
        { text: "", type: "context" },
      ],
      syntax: {
        after: expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Revised"),
            }),
          ]),
        ]),
        before: expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({ text: expect.stringContaining("Agent") }),
          ]),
        ]),
      },
    });
    /* oxlint-enable typescript/no-unsafe-assignment */
  });

  it("validates and passes the requested theme for history previews", async () => {
    const baseUrl = await startServer();
    const history = await historyBody(await fetch(`${baseUrl}/__mdxr_history`));

    const themePreviews = await Promise.all(
      (["dark", "light"] as const).map(async (theme) => {
        const response = await fetch(
          `${baseUrl}/__mdxr_history?view=preview&id=${history.latestId}&theme=${theme}`
        );
        return {
          body: await response.text(),
          status: response.status,
          theme,
        };
      })
    );
    expect(themePreviews).toStrictEqual([
      { body: "historical preview", status: 200, theme: "dark" },
      { body: "historical preview", status: 200, theme: "light" },
    ]);
    const themeRenderCalls = vi
      .mocked(render)
      .mock.calls.map(([source, options]) => ({
        dir: options?.dir,
        filePath: options?.filePath,
        initialTheme: options?.initialTheme,
        liveReload: options?.liveReload,
        source,
      }))
      .toSorted((first, second) =>
        (first.initialTheme ?? "").localeCompare(second.initialTheme ?? "")
      );
    expect(themeRenderCalls).toStrictEqual([
      {
        dir,
        filePath,
        initialTheme: "dark",
        liveReload: false,
        source: "# Agent preview\n",
      },
      {
        dir,
        filePath,
        initialTheme: "light",
        liveReload: false,
        source: "# Agent preview\n",
      },
    ]);

    const defaultThemeResponse = await fetch(
      `${baseUrl}/__mdxr_history?view=preview&id=${history.latestId}`
    );
    expect(defaultThemeResponse.status).toBe(200);
    expect(vi.mocked(render)).toHaveBeenLastCalledWith("# Agent preview\n", {
      dir,
      filePath,
      initialTheme: undefined,
      liveReload: false,
    });

    const invalidThemeResponse = await fetch(
      `${baseUrl}/__mdxr_history?view=preview&id=${history.latestId}&theme=auto`
    );
    expect({
      body: await invalidThemeResponse.text(),
      renderCallCount: vi.mocked(render).mock.calls.length,
      status: invalidThemeResponse.status,
    }).toStrictEqual({
      body: '{"error":"Invalid preview theme"}',
      renderCallCount: 3,
      status: 400,
    });
  });

  it("records the pre-instruction MDX version before forwarding a message", async () => {
    const baseUrl = await startServer("codex");
    const response = await fetch(`${baseUrl}/__mdxr_agent`, {
      body: JSON.stringify({ message: "Revise this document" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(response.status).toBe(200);
    expect(sendAgentMessage).toHaveBeenCalledOnce();

    const historyResponse = await fetch(`${baseUrl}/__mdxr_history`);
    const history = await historyBody(historyResponse);
    expect(history.versions).toMatchObject([
      { kind: "initial" },
      { kind: "before-instruction" },
    ]);
    const [first, second] = history.versions;
    if (
      typeof first !== "object" ||
      first === null ||
      !("contentHash" in first) ||
      typeof second !== "object" ||
      second === null ||
      !("contentHash" in second)
    ) {
      throw new TypeError("Invalid history version");
    }
    expect(first.contentHash).toBe(second.contentHash);
  });
});

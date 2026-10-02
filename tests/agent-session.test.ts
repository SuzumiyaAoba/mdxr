import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAgentSession } from "../src/agent-session.js";
import { createClaudeStreamSession } from "../src/claude-stream-session.js";
import { createCodexAppServerSession } from "../src/codex-app-server.js";

vi.mock(import("../src/codex-app-server.js"), () => ({
  createCodexAppServerSession: vi.fn<typeof createCodexAppServerSession>(),
}));
vi.mock(import("../src/claude-stream-session.js"), () => ({
  createClaudeStreamSession: vi.fn<typeof createClaudeStreamSession>(),
}));

describe("live agent sessions", () => {
  let dir: string;
  let documentPath: string;
  let originalCwd: string;
  const codexSend =
    vi.fn<
      (message: string) => Promise<{ sessionId: string; answer: string }>
    >();
  const codexEnqueue = vi.fn<
    (message: string) => Promise<{
      sessionId: string;
      completion: Promise<string>;
    }>
  >();
  const claudeSend =
    vi.fn<
      (message: string) => Promise<{ sessionId: string; answer: string }>
    >();
  const codexClose = vi.fn<() => Promise<void>>();
  const claudeClose = vi.fn<() => Promise<void>>();

  beforeEach(async () => {
    originalCwd = process.cwd();
    dir = await realpath(
      await mkdtemp(path.join(os.tmpdir(), "mdxr-agent-session-"))
    );
    documentPath = path.join(dir, "plan.mdx");
    await writeFile(documentPath, "# Plan\n");
    process.chdir(dir);
    vi.mocked(createCodexAppServerSession).mockReset().mockReturnValue({
      close: codexClose,
      enqueue: codexEnqueue,
      send: codexSend,
    });
    vi.mocked(createClaudeStreamSession).mockReset().mockReturnValue({
      close: claudeClose,
      send: claudeSend,
    });
    codexSend.mockReset();
    codexEnqueue.mockReset();
    claudeSend.mockReset();
    codexClose.mockReset().mockResolvedValue();
    claudeClose.mockReset().mockResolvedValue();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(dir, { force: true, recursive: true });
  });

  it("uses one shared Codex connection for successive turns", async () => {
    codexEnqueue
      .mockResolvedValueOnce({
        completion: Promise.resolve("First answer"),
        sessionId: "thread-1",
      })
      .mockResolvedValueOnce({
        completion: Promise.resolve("Second answer"),
        sessionId: "thread-1",
      });
    const session = createAgentSession(
      documentPath,
      "codex",
      "thread-1",
      "ws://127.0.0.1:4500"
    );

    await session.send("First question");
    await vi.waitFor(async () => {
      await expect(session.current()).resolves.toMatchObject({ busy: false });
    });
    await session.send("Second question");
    await vi.waitFor(async () => {
      await expect(session.current()).resolves.toMatchObject({ busy: false });
    });
    const second = await session.current();

    expect(createCodexAppServerSession).toHaveBeenCalledExactlyOnceWith({
      cwd: dir,
      endpoint: "ws://127.0.0.1:4500",
      initialSessionId: "thread-1",
    });
    expect(codexEnqueue.mock.calls).toStrictEqual([
      ["First question"],
      ["Second question"],
    ]);
    expect(second.messages).toStrictEqual([
      { content: "First question", role: "user" },
      { content: "First answer", role: "assistant" },
      { content: "Second question", role: "user" },
      { content: "Second answer", role: "assistant" },
    ]);
    const store: unknown = JSON.parse(
      await readFile(path.join(dir, ".mdxr", "sessions.json"), "utf-8")
    );
    expect(store).toMatchObject({
      documents: { [documentPath]: { sessionId: "thread-1" } },
    });
    await session.close();
    expect(codexClose).toHaveBeenCalledOnce();
  });

  it("keeps Claude in one SDK process and starts fresh with each preview", async () => {
    claudeSend
      .mockResolvedValueOnce({ answer: "First answer", sessionId: "claude-1" })
      .mockResolvedValueOnce({
        answer: "Second answer",
        sessionId: "claude-1",
      });
    const session = createAgentSession(documentPath, "claude");

    await session.send("First question");
    await session.send("Second question");

    expect(createClaudeStreamSession).toHaveBeenCalledExactlyOnceWith(dir);
    expect(claudeSend.mock.calls).toStrictEqual([
      [
        `This message was sent from the preview of ${documentPath}.\n\nFirst question`,
      ],
      ["Second question"],
    ]);
    await session.close();
    expect(claudeClose).toHaveBeenCalledOnce();

    const nextPreview = createAgentSession(documentPath, "claude");
    await expect(nextPreview.current()).resolves.toMatchObject({
      messages: [],
      provider: "claude",
    });
  });

  it("retains every document when multiple conversations save together", async () => {
    codexSend.mockResolvedValue({ answer: "Answer", sessionId: "thread-1" });
    const documents = Array.from({ length: 8 }, (_, index) =>
      path.join(dir, `document-${index}.mdx`)
    );
    const sessions = documents.map((file) => createAgentSession(file, "codex"));
    await Promise.all(
      sessions.map(async (session) => await session.send("Hello"))
    );
    const store: unknown = JSON.parse(
      await readFile(path.join(dir, ".mdxr", "sessions.json"), "utf-8")
    );
    expect(store).toMatchObject({
      documents: Object.fromEntries(
        documents.map((file) => [
          file,
          {
            messages: [
              { content: "Hello", role: "user" },
              { role: "assistant" },
            ],
          },
        ])
      ),
    });
    await Promise.all(
      sessions.map(async (session) => {
        await session.close();
      })
    );
  });

  it.each([
    { documents: [], version: 1 },
    {
      documents: {
        invalid: { messages: [null], provider: "codex" },
      },
      version: 1,
    },
  ])(
    "rejects malformed stores without sending or overwriting them (%j)",
    async (store) => {
      const storePath = path.join(dir, ".mdxr", "sessions.json");
      await mkdir(path.dirname(storePath));
      const source = JSON.stringify(store);
      await writeFile(storePath, source);
      codexSend.mockResolvedValue({ answer: "Answer", sessionId: "thread-1" });
      const session = createAgentSession(documentPath, "codex");

      await expect(session.send("Hello")).rejects.toThrow(
        "Invalid mdxr session store"
      );
      expect(codexSend).not.toHaveBeenCalled();
      await expect(readFile(storePath, "utf-8")).resolves.toBe(source);
      await session.close();
    }
  );

  it("records a queued message immediately and adds its answer later", async () => {
    let resolveCompletion: ((value: string) => void) | undefined;
    // oxlint-disable-next-line promise/avoid-new -- Control when the queued provider answer arrives.
    const completion = new Promise<string>((resolve) => {
      resolveCompletion = resolve;
    });
    const onUpdate = vi.fn<() => void>();
    vi.mocked(createCodexAppServerSession).mockReturnValue({
      close: codexClose,
      enqueue: vi.fn<typeof codexEnqueue>().mockResolvedValue({
        completion,
        sessionId: "live-thread",
      }),
      send: codexSend,
    });
    const session = createAgentSession(documentPath, "codex", "live-thread");
    session.setOnUpdate(onUpdate);

    await expect(session.send("From MDX")).resolves.toMatchObject({
      busy: true,
      messages: [{ content: "From MDX", role: "user" }],
      sessionId: "live-thread",
    });
    await expect(session.current()).resolves.toMatchObject({ busy: true });
    expect(codexSend).not.toHaveBeenCalled();

    resolveCompletion?.("Received in the live session");
    await vi.waitFor(() => {
      expect(onUpdate).toHaveBeenCalledOnce();
    });
    await expect(session.current()).resolves.toMatchObject({
      busy: false,
      messages: [
        { content: "From MDX", role: "user" },
        { content: "Received in the live session", role: "assistant" },
      ],
    });
  });

  it("rejects a second send while the provider is responding", async () => {
    let finish:
      | ((value: { answer: string; sessionId: string }) => void)
      | undefined;
    codexSend.mockImplementationOnce(
      async () =>
        // A deferred provider reply is needed to exercise the busy guard.
        // oxlint-disable-next-line promise/avoid-new
        await new Promise<{ answer: string; sessionId: string }>((resolve) => {
          finish = resolve;
        })
    );
    const session = createAgentSession(documentPath, "codex");
    const first = session.send("First question");
    await expect(session.send("Second question")).rejects.toThrow(
      "Agent is already responding"
    );
    await vi.waitFor(() => {
      expect(finish).toBeTypeOf("function");
    });
    finish?.({ answer: "First answer", sessionId: "thread-1" });
    await expect(first).resolves.toMatchObject({ sessionId: "thread-1" });
  });

  it("does not replace a requested Codex thread after a connection error", async () => {
    codexEnqueue.mockRejectedValueOnce(new Error("thread is owned elsewhere"));
    const session = createAgentSession(documentPath, "codex", "thread-1");

    await expect(session.send("Hello")).rejects.toThrow(
      "thread is owned elsewhere"
    );
    await expect(session.current()).resolves.toMatchObject({
      messages: [],
      sessionId: "thread-1",
    });
    expect(createCodexAppServerSession).toHaveBeenCalledWith({
      cwd: dir,
      endpoint: undefined,
      initialSessionId: "thread-1",
    });
  });
});

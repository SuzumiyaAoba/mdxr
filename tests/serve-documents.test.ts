import { once } from "node:events";
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAgentSession } from "../src/agent-session.js";
import { serveLibrary } from "../src/library.js";
import { openInBrowser } from "../src/open.js";
import type { render } from "../src/render.js";
import { renderFile } from "../src/render.js";
import { serveDocuments } from "../src/serve-documents.js";

type AgentSession = ReturnType<typeof createAgentSession>;

vi.mock(import("../src/open.js"), () => ({
  openInBrowser: vi.fn<typeof openInBrowser>(),
}));
vi.mock(import("../src/render.js"), () => ({
  render: vi.fn<typeof render>(),
  renderFile: vi.fn<typeof renderFile>(),
}));
vi.mock(import("../src/agent-session.js"), () => ({
  createAgentSession: vi.fn<typeof createAgentSession>(),
}));

const serverUrl = (server: Server): string => {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Document library did not start");
  }
  return `http://127.0.0.1:${address.port}`;
};

describe("serve document directories", () => {
  let root: string;
  let server: Server | undefined;
  const closeAgent = vi.fn<AgentSession["close"]>().mockResolvedValue();

  beforeEach(async () => {
    root = await realpath(
      await mkdtemp(path.join(os.tmpdir(), "mdxr-serve-documents-"))
    );
    vi.spyOn(process, "cwd").mockReturnValue(root);
    vi.mocked(openInBrowser).mockReset().mockResolvedValue();
    vi.mocked(renderFile)
      .mockReset()
      .mockResolvedValue("<html><body>Document preview</body></html>");
    closeAgent.mockClear();
    vi.mocked(createAgentSession)
      .mockReset()
      .mockImplementation((_file, provider) => ({
        close: closeAgent,
        current: vi.fn<AgentSession["current"]>().mockResolvedValue({
          busy: false,
          messages: [],
          provider,
        }),
        send: vi.fn<AgentSession["send"]>(),
        setOnUpdate: vi.fn<AgentSession["setOnUpdate"]>(),
      }));
  });

  afterEach(async () => {
    if (server?.listening === true) {
      const closed = once(server, "close");
      server.closeAllConnections();
      server.close();
      await closed;
      server = undefined;
    }
    vi.restoreAllMocks();
    await rm(root, { force: true, recursive: true });
  });

  const addDocument = async (relativePath: string): Promise<string> => {
    const file = path.join(root, relativePath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `# ${relativePath}\n`);
    return file;
  };

  it("creates and serves an empty .mdxr directory without reading stdin", async () => {
    server = await serveDocuments(undefined, 0);
    const url = serverUrl(server);
    const listing = await fetch(url);
    const results = await fetch(`${url}/__mdxr_library/search`);

    await expect(listing.text()).resolves.toContain('id="mdxr-library-root"');
    await expect(results.json()).resolves.toMatchObject({
      results: [],
      root: path.join(root, ".mdxr"),
      total: 0,
    });
    expect(openInBrowser).not.toHaveBeenCalled();
    expect(renderFile).not.toHaveBeenCalled();
  });

  it("serves sibling documents while opening the requested Japanese document path", async () => {
    const selectedPath = ".mdxr/20260930170000-設計 と 検証/index.mdx";
    const selected = await addDocument(selectedPath);
    await addDocument(".mdxr/20260930160000-other/index.mdx");
    server = await serveDocuments(".mdxr", 0, { open: selectedPath });
    const url = serverUrl(server);
    const results = await fetch(`${url}/__mdxr_library/search`);
    await expect(results.json()).resolves.toMatchObject({ total: 2 });
    expect(renderFile).not.toHaveBeenCalled();
    const openedUrl = vi.mocked(openInBrowser).mock.calls[0]?.[0];
    if (openedUrl === undefined) {
      throw new Error("Selected document was not opened");
    }
    const opened = await fetch(openedUrl, { redirect: "manual" });
    const location = opened.headers.get("location");
    if (location === null) {
      throw new Error("Selected document did not return a preview URL");
    }

    expect({
      path: decodeURIComponent(new URL(location).pathname),
      status: opened.status,
    }).toStrictEqual({
      path: "/20260930170000-設計 と 検証/index.mdx",
      status: 303,
    });
    const preview = await fetch(location);
    await expect(preview.text()).resolves.toContain("Document preview");
    expect(renderFile).toHaveBeenCalledWith(selected, expect.anything());
  });

  it("uses the entire .mdxr root when a file argument selects the initial preview", async () => {
    const selected = await addDocument(".mdxr/first/index.mdx");
    await addDocument(".mdxr/second/index.mdx");
    server = await serveDocuments(selected, 0, { open: true });
    const results = await fetch(`${serverUrl(server)}/__mdxr_library/search`);

    await expect(results.json()).resolves.toMatchObject({
      root: path.join(root, ".mdxr"),
      total: 2,
    });
    expect(openInBrowser).toHaveBeenCalledWith(
      expect.stringMatching(/\/__mdxr_library\/open\/first%2Findex\.mdx$/u)
    );
  });

  it("uses the parent library for a document outside .mdxr and opens the listing only on request", async () => {
    const selected = await addDocument("reports/plan.mdx");
    await addDocument("reports/notes.md");
    server = await serveDocuments(selected, 0);
    const results = await fetch(`${serverUrl(server)}/__mdxr_library/search`);

    await expect(results.json()).resolves.toMatchObject({
      root: path.join(root, "reports"),
      total: 2,
    });
    expect(openInBrowser).not.toHaveBeenCalled();
  });

  it("forwards the agent connection to each selected workspace and reuses its session", async () => {
    const selected = await addDocument(".mdxr/first/index.mdx");
    await addDocument(".mdxr/second/index.mdx");
    server = await serveDocuments(undefined, 0, {
      agent: "codex",
      server: "ws://127.0.0.1:4500",
      session: "selected-thread",
    });
    expect(createAgentSession).not.toHaveBeenCalled();
    const url = serverUrl(server);
    const openUrl = `${url}/__mdxr_library/open/first%2Findex.mdx`;
    const opened = await fetch(openUrl, { redirect: "manual" });
    const repeated = await fetch(openUrl, { redirect: "manual" });
    const second = await fetch(
      `${url}/__mdxr_library/open/second%2Findex.mdx`,
      {
        redirect: "manual",
      }
    );
    const location = opened.headers.get("location");
    if (location === null) {
      throw new Error("Agent workspace did not open");
    }

    expect({
      repeated: repeated.headers.get("location"),
      second: second.status,
    }).toStrictEqual({ repeated: location, second: 303 });
    expect(createAgentSession).toHaveBeenCalledTimes(2);
    expect(createAgentSession).toHaveBeenCalledWith(
      selected,
      "codex",
      "selected-thread",
      "ws://127.0.0.1:4500"
    );
    const preview = await fetch(location);
    await expect(preview.text()).resolves.toContain(
      'data-mdxr-agent data-agent-provider="codex"'
    );
  });

  it("opens the directory listing when --open has no document path", async () => {
    server = await serveDocuments(undefined, 0, { open: true });
    const openedUrl = vi.mocked(openInBrowser).mock.calls[0]?.[0];
    expect(openedUrl).toMatch(/^http:\/\/localhost:\d+\/$/u);
  });

  it("expires unused document sessions while the library remains open and recreates them on demand", async () => {
    await addDocument(".mdxr/first/index.mdx");
    server = await serveDocuments(undefined, 0, {
      agent: "codex",
      idleTimeout: 0.1,
    });
    const url = serverUrl(server);
    const controller = new AbortController();
    try {
      const listing = await fetch(`${url}/__mdxr_events`, {
        signal: controller.signal,
      });
      expect(listing.headers.get("content-type")).toBe("text/event-stream");
      const openUrl = `${url}/__mdxr_library/open/first%2Findex.mdx`;
      const first = await fetch(openUrl);
      await first.text();
      await vi.waitFor(() => {
        expect(closeAgent).toHaveBeenCalledOnce();
      });
      expect(server.listening).toBeTruthy();
      const reopened = await fetch(openUrl);
      await reopened.text();
      expect(reopened.status).toBe(200);
      expect(createAgentSession).toHaveBeenCalledTimes(2);
    } finally {
      controller.abort();
    }
  });

  it("keeps the library alive for a connected document and closes both after disconnect", async () => {
    await addDocument(".mdxr/first/index.mdx");
    server = await serveDocuments(undefined, 0, {
      agent: "codex",
      idleTimeout: 0.1,
    });
    const url = serverUrl(server);
    const preview = await fetch(`${url}/__mdxr_library/open/first%2Findex.mdx`);
    await preview.text();
    const controller = new AbortController();
    try {
      const events = await fetch(
        `${new URL(preview.url).origin}/__mdxr_events`,
        {
          signal: controller.signal,
        }
      );
      expect(events.status).toBe(200);
      await delay(300);
      expect(server.listening).toBeTruthy();
      expect(closeAgent).not.toHaveBeenCalled();
    } finally {
      controller.abort();
    }
    await vi.waitFor(() => {
      expect(server?.listening).toBeFalsy();
      expect(closeAgent).toHaveBeenCalledOnce();
    });
  });

  it("rejects missing, excluded, external, and symlinked initial documents", async () => {
    await mkdir(path.join(root, ".mdxr"));
    const outside = await addDocument("outside.mdx");
    await addDocument(".mdxr/history/hidden.mdx");
    await symlink(outside, path.join(root, ".mdxr/linked.mdx"));
    const files = [
      ".mdxr/missing.mdx",
      ".mdxr/history/hidden.mdx",
      "outside.mdx",
      ".mdxr/linked.mdx",
    ];
    await Promise.all(
      files.map(async (file) => {
        await expect(
          serveDocuments(".mdxr", 0, { open: file })
        ).rejects.toThrow("Cannot open document in this library");
      })
    );
    expect(openInBrowser).not.toHaveBeenCalled();
    expect(renderFile).not.toHaveBeenCalled();
  });

  it("validates agent options before starting the directory server", async () => {
    await expect(
      serveLibrary(".mdxr", 0, { session: "thread" })
    ).rejects.toThrow("--session requires --agent");
    await expect(
      serveLibrary(".mdxr", 0, { agent: "claude", session: "thread" })
    ).rejects.toThrow("--session is only supported for codex");
    await expect(
      serveLibrary(".mdxr", 0, { agent: "claude", server: "ws://localhost" })
    ).rejects.toThrow("--server requires --agent codex");
  });
});

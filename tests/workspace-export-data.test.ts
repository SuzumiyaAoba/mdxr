import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DocumentHistory } from "../src/document-history.js";
import { createDocumentHistory } from "../src/document-history.js";
import { handleWorkspaceExportRequest } from "../src/workspace-export-data.js";

interface CapturedResponse {
  body: string;
  headers: Record<string, string | number | string[] | undefined>;
  status: number;
}

interface ExportAgent {
  current: () => Promise<{
    provider: "codex" | "claude";
    messages: { role: "user" | "assistant"; content: string }[];
    busy: boolean;
    error?: string;
  }>;
}

interface ExportVersion {
  diff: { text: string; type: "context" | "add" | "remove" }[];
  id: string;
  source: string;
}

interface ExportResponseBody {
  conversation: {
    busy: boolean;
    messages: { content: string; role: "user" | "assistant" }[];
    provider: "codex" | "claude";
    sessionId?: string;
  } | null;
  exportedAt: string;
  file: string;
  latestId: string;
  versions: ExportVersion[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isExportVersion = (value: unknown): value is ExportVersion =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.source === "string" &&
  Array.isArray(value.diff) &&
  value.diff.every(
    (line) =>
      isRecord(line) &&
      typeof line.text === "string" &&
      (line.type === "context" || line.type === "add" || line.type === "remove")
  );

const isExportResponseBody = (value: unknown): value is ExportResponseBody => {
  if (
    !isRecord(value) ||
    typeof value.exportedAt !== "string" ||
    typeof value.file !== "string" ||
    typeof value.latestId !== "string" ||
    !Array.isArray(value.versions) ||
    !value.versions.every(isExportVersion)
  ) {
    return false;
  }
  const { conversation } = value;
  if (conversation === null) {
    return true;
  }
  if (
    !isRecord(conversation) ||
    typeof conversation.busy !== "boolean" ||
    (conversation.provider !== "codex" && conversation.provider !== "claude") ||
    !Array.isArray(conversation.messages) ||
    !conversation.messages.every(
      (message) =>
        isRecord(message) &&
        typeof message.content === "string" &&
        (message.role === "user" || message.role === "assistant")
    ) ||
    (conversation.sessionId !== undefined &&
      typeof conversation.sessionId !== "string")
  ) {
    return false;
  }
  return true;
};

const requestWith = (method: string, origin?: string): IncomingMessage => {
  const request = new IncomingMessage(new Socket());
  request.headers.host = "127.0.0.1:3737";
  if (origin !== undefined) {
    request.headers.origin = origin;
  }
  request.method = method;
  Object.defineProperty(request.socket, "localPort", { value: 3737 });
  return request;
};

const captureResponse = (
  request: IncomingMessage
): { capture: CapturedResponse; response: ServerResponse } => {
  const response = new ServerResponse(request);
  const capture: CapturedResponse = {
    body: "",
    headers: {},
    status: 0,
  };
  Object.defineProperty(response, "writeHead", {
    value: (status: number, headers: Record<string, string>) => {
      capture.headers = headers;
      capture.status = status;
      return response;
    },
  });
  Object.defineProperty(response, "end", {
    value: (chunk?: string | Uint8Array) => {
      capture.body =
        typeof chunk === "string" ? chunk : Buffer.from(chunk ?? "").toString();
    },
  });
  return { capture, response };
};

describe("workspace export data endpoint", () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "mdxr-workspace-export-"));
    filePath = path.join(dir, "review.mdx");
    await writeFile(filePath, "# First version\n");
  });

  afterEach(async () => {
    await rm(dir, { force: true, recursive: true });
  });

  const requestExport = async (
    options: {
      history?: DocumentHistory;
      agent?: ExportAgent;
      method?: string;
      origin?: string;
    } = {}
  ): Promise<CapturedResponse> => {
    const { agent, history, method = "GET", origin } = options;
    const request = requestWith(method, origin);
    const { capture, response } = captureResponse(request);
    await handleWorkspaceExportRequest(
      request,
      response,
      filePath,
      history,
      agent
    );
    return capture;
  };

  it("returns every source, adjacent diff, and the current conversation", async () => {
    const history = createDocumentHistory(filePath, dir);
    const initial = await history.capture("initial");
    await writeFile(filePath, "# Revised version\n\nAdded detail.\n");
    const agent: ExportAgent = {
      current: async () =>
        await Promise.resolve({
          busy: false,
          messages: [
            { content: "Please review this", role: "user" },
            { content: "Looks good", role: "assistant" },
          ],
          provider: "codex",
          sessionId: "thread-123",
        }),
    };

    const response = await requestExport({ agent, history });
    /* oxlint-disable typescript/no-unsafe-assignment -- The payload is checked below. */
    const rawBody: unknown = JSON.parse(response.body);
    /* oxlint-enable typescript/no-unsafe-assignment */

    if (!isExportResponseBody(rawBody)) {
      throw new TypeError("Invalid workspace export body");
    }
    const body = rawBody;

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(body.latestId).toBe(body.versions[1]?.id);
    expect(body.versions).toHaveLength(2);
    expect(body).toMatchObject({
      conversation: {
        busy: false,
        messages: [
          { content: "Please review this", role: "user" },
          { content: "Looks good", role: "assistant" },
        ],
        provider: "codex",
        sessionId: "thread-123",
      },
      file: filePath,
      versions: [
        {
          diff: [],
          id: initial.id,
          source: "# First version\n",
        },
        {
          diff: [
            { text: "# First version", type: "remove" },
            { text: "# Revised version", type: "add" },
            { text: "", type: "context" },
            { text: "Added detail.", type: "add" },
            { text: "", type: "add" },
          ],
          source: "# Revised version\n\nAdded detail.\n",
        },
      ],
    });
  });

  it("rejects cross-origin, non-GET, and unavailable history requests", async () => {
    const history = createDocumentHistory(filePath, dir);
    const crossOrigin = await requestExport({
      history,
      origin: "https://attacker.example",
    });
    const wrongMethod = await requestExport({ history, method: "POST" });
    const unavailable = await requestExport();

    expect(crossOrigin.status).toBe(403);
    expect(wrongMethod.status).toBe(405);
    expect(unavailable.status).toBe(404);
  });

  it("returns an error instead of a partial archive when a version cannot be read", async () => {
    const versionId = "00000000-0000-4000-8000-000000000001";
    const history: DocumentHistory = {
      capture: async () =>
        await Promise.resolve({
          contentHash: "0".repeat(64),
          createdAt: new Date().toISOString(),
          id: versionId,
          kind: "initial",
          sequence: 1,
          size: 0,
        }),
      diff: async () => await Promise.resolve({ lines: [] }),
      list: async () =>
        await Promise.resolve({
          latestId: versionId,
          versions: [
            {
              contentHash: "0".repeat(64),
              createdAt: new Date().toISOString(),
              id: versionId,
              kind: "initial",
              sequence: 1,
              size: 0,
            },
          ],
        }),
      read: async () =>
        await Promise.reject(new Error("version blob is corrupt")),
    };

    const response = await requestExport({ history });
    /* oxlint-disable typescript/no-unsafe-assignment -- The payload is checked below. */
    const body: unknown = JSON.parse(response.body);
    /* oxlint-enable typescript/no-unsafe-assignment */

    expect(response.status).toBe(500);
    expect(body).toStrictEqual({ error: "version blob is corrupt" });
  });
});

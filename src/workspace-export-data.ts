import type http from "node:http";
import path from "node:path";

import type { AgentConversation } from "./agent-session.js";
import type {
  DocumentDiffLine,
  DocumentHistory,
  DocumentVersion,
} from "./document-history.js";
import { formatError } from "./format-error.js";

export interface WorkspaceExportData {
  file: string;
  exportedAt: string;
  latestId: string;
  versions: (DocumentVersion & {
    source: string;
    diff: DocumentDiffLine[];
  })[];
  conversation: (AgentConversation & { busy: boolean; error?: string }) | null;
}

interface AgentSession {
  current: () => Promise<AgentConversation & { busy: boolean; error?: string }>;
}

/** Collect a complete, internally consistent archive of one served document. */
export const createWorkspaceExportData = async (
  filePath: string,
  history: DocumentHistory,
  agent?: AgentSession
): Promise<WorkspaceExportData> => {
  await history.capture("change");
  const { latestId, versions } = await history.list();

  const exportedVersions = await Promise.all(
    versions.map(async (version, index) => {
      const previous = versions[index - 1];
      const source = await history.read(version.id);
      let diff: DocumentDiffLine[] = [];
      if (previous !== undefined) {
        const compared = await history.diff(previous.id, version.id);
        diff = compared.lines;
      }
      return { ...version, diff, source };
    })
  );

  return {
    conversation: agent === undefined ? null : await agent.current(),
    exportedAt: new Date().toISOString(),
    file: path.resolve(filePath),
    latestId,
    versions: exportedVersions,
  };
};

const replyJson = (
  response: http.ServerResponse,
  status: number,
  body: unknown
): void => {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
};

const sameOrigin = (request: http.IncomingMessage): boolean => {
  const port = request.socket.localPort;
  const host = request.headers.host ?? "";
  const allowed = host === `localhost:${port}` || host === `127.0.0.1:${port}`;
  return (
    allowed &&
    (request.headers.origin === undefined ||
      request.headers.origin === `http://${host}`)
  );
};

/** Serve a complete archive to the local workspace export action. */
export const handleWorkspaceExportRequest = async (
  request: http.IncomingMessage,
  response: http.ServerResponse,
  filePath: string | undefined,
  history: DocumentHistory | undefined,
  agent?: AgentSession
): Promise<void> => {
  if (history === undefined || filePath === undefined) {
    replyJson(response, 404, { error: "Document history is unavailable" });
    return;
  }
  if (!sameOrigin(request)) {
    replyJson(response, 403, { error: "Request origin is not allowed" });
    return;
  }
  if (request.method !== "GET") {
    replyJson(response, 405, { error: "Method not allowed" });
    return;
  }
  try {
    replyJson(
      response,
      200,
      await createWorkspaceExportData(filePath, history, agent)
    );
  } catch (error) {
    replyJson(response, 500, { error: formatError(error) });
  }
};

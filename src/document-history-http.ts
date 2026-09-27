import type http from "node:http";
import path from "node:path";

import { DocumentHistoryError } from "./document-history.js";
import type { createDocumentHistory } from "./document-history.js";
import { formatError } from "./format-error.js";
import { highlightMdxSource } from "./rehype/shiki.js";
import { render } from "./render.js";

type DocumentHistory = ReturnType<typeof createDocumentHistory>;
type PreviewTheme = "dark" | "light";

/** `undefined` means the query is absent; `null` marks an unsupported value. */
const parsePreviewTheme = (
  value: string | null
): PreviewTheme | null | undefined => {
  if (value === null) {
    return undefined;
  }
  return value === "light" || value === "dark" ? value : null;
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

/** Reconstruct both sides from the same diff snapshot before highlighting. */
const replyDiff = async (
  response: http.ServerResponse,
  history: DocumentHistory,
  from: string,
  to: string
): Promise<void> => {
  const { lines } = await history.diff(from, to);
  const beforeSource: string[] = [];
  const afterSource: string[] = [];
  for (const line of lines) {
    if (line.type !== "add") {
      beforeSource.push(line.text);
    }
    if (line.type !== "remove") {
      afterSource.push(line.text);
    }
  }
  const [before, after] = await Promise.all([
    highlightMdxSource(beforeSource.join("\n")),
    highlightMdxSource(afterSource.join("\n")),
  ]);
  replyJson(response, 200, { from, lines, syntax: { after, before }, to });
};

const replyPreview = async (
  response: http.ServerResponse,
  history: DocumentHistory,
  filePath: string,
  id: string,
  requestedTheme: string | null
): Promise<void> => {
  const theme = parsePreviewTheme(requestedTheme);
  if (theme === null) {
    replyJson(response, 400, { error: "Invalid preview theme" });
    return;
  }
  const source = await history.read(id);
  const html = await render(source, {
    dir: path.dirname(filePath),
    filePath,
    initialTheme: theme ?? undefined,
    liveReload: false,
  });
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": "text/html; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(html);
};

const replyHistoryView = async (
  response: http.ServerResponse,
  history: DocumentHistory,
  filePath: string,
  params: URLSearchParams
): Promise<void> => {
  const view = params.get("view");
  if (view === null) {
    replyJson(response, 200, await history.list());
    return;
  }
  const id = params.get("id");
  if (view === "source" && id !== null) {
    const source = await history.read(id);
    const syntax = await highlightMdxSource(source);
    replyJson(response, 200, { id, source, syntax });
    return;
  }
  if (view === "diff") {
    const from = params.get("from");
    const to = params.get("to");
    if (from !== null && to !== null) {
      await replyDiff(response, history, from, to);
      return;
    }
  }
  if (view === "preview" && id !== null) {
    await replyPreview(response, history, filePath, id, params.get("theme"));
    return;
  }
  replyJson(response, 400, { error: "Invalid history view or version" });
};

/** Read-only endpoints for the local, token-free MDX version store. */
export const handleDocumentHistoryRequest = async (
  request: http.IncomingMessage,
  response: http.ServerResponse,
  history: DocumentHistory | undefined,
  filePath: string | undefined
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
  const url = new URL(request.url ?? "", "http://localhost");
  try {
    await replyHistoryView(response, history, filePath, url.searchParams);
  } catch (error) {
    const detail = formatError(error);
    const missingVersion =
      error instanceof DocumentHistoryError &&
      (error.kind === "invalid-version" || error.kind === "unknown-version");
    replyJson(response, missingVersion ? 404 : 500, { error: detail });
  }
};

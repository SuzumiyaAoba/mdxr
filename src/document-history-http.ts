import type http from "node:http";
import path from "node:path";

import type { ConfigOptions } from "./config.js";
import { DocumentHistoryError } from "./document-history.js";
import type { createDocumentHistory } from "./document-history.js";
import { formatError } from "./format-error.js";
import { isLocalOrigin, replyJson, replyText } from "./local-http.js";
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
  requestedTheme: string | null,
  configOptions: ConfigOptions
): Promise<void> => {
  const theme = parsePreviewTheme(requestedTheme);
  if (theme === null) {
    replyJson(response, 400, { error: "Invalid preview theme" });
    return;
  }
  const source = await history.read(id);
  const html = await render(source, {
    ...configOptions,
    dir: path.dirname(filePath),
    filePath,
    initialTheme: theme ?? undefined,
    liveReload: false,
  });
  replyText(response, 200, html, "text/html; charset=utf-8");
};

const replyHistoryView = async (
  response: http.ServerResponse,
  history: DocumentHistory,
  filePath: string,
  params: URLSearchParams,
  configOptions: ConfigOptions
): Promise<void> => {
  const view = params.get("view");
  if (view === null) {
    replyJson(response, 200, await history.list());
    return;
  }
  const id = params.get("id");
  if (view === "dependencies" && id !== null) {
    replyJson(response, 200, { id, ...(await history.dependencies?.(id)) });
    return;
  }
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
    await replyPreview(
      response,
      history,
      filePath,
      id,
      params.get("theme"),
      configOptions
    );
    return;
  }
  replyJson(response, 400, { error: "Invalid history view or version" });
};

/** Read-only endpoints for the local, token-free MDX version store. */
export const handleDocumentHistoryRequest = async (
  request: http.IncomingMessage,
  response: http.ServerResponse,
  history: DocumentHistory | undefined,
  filePath: string | undefined,
  configOptions: ConfigOptions = {}
): Promise<void> => {
  if (history === undefined || filePath === undefined) {
    replyJson(response, 404, { error: "Document history is unavailable" });
    return;
  }
  if (!isLocalOrigin(request)) {
    replyJson(response, 403, { error: "Request origin is not allowed" });
    return;
  }
  if (request.method !== "GET") {
    replyJson(response, 405, { error: "Method not allowed" }, { allow: "GET" });
    return;
  }
  const url = new URL(request.url ?? "", "http://localhost");
  try {
    await replyHistoryView(
      response,
      history,
      filePath,
      url.searchParams,
      configOptions
    );
  } catch (error) {
    const detail = formatError(error);
    const missingVersion =
      error instanceof DocumentHistoryError &&
      (error.kind === "invalid-version" || error.kind === "unknown-version");
    replyJson(response, missingVersion ? 404 : 500, { error: detail });
  }
};

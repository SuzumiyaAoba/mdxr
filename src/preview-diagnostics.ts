import { readFile } from "node:fs/promises";
import type http from "node:http";

import type { DocumentDiagnostic } from "./check-diagnostics.js";
import { checkDocument } from "./check.js";
import type { CheckOptions } from "./check.js";
import { isLocalOrigin, replyJson } from "./local-http.js";

export interface PreviewDiagnosticData {
  file: string;
  source: string;
  diagnostics: DocumentDiagnostic[];
  checkedAt: string;
}

export const handleDiagnosticSourceRequest = async (
  request: http.IncomingMessage,
  response: http.ServerResponse,
  data: PreviewDiagnosticData
): Promise<void> => {
  if (!isLocalOrigin(request) || request.method !== "GET") {
    replyJson(response, 403, { error: "Request is not allowed" });
    return;
  }
  const url = new URL(request.url ?? "", "http://localhost");
  const file = url.searchParams.get("file") ?? data.file;
  const allowed =
    file === data.file ||
    data.diagnostics.some((diagnostic) => diagnostic.file === file);
  if (!allowed) {
    replyJson(response, 404, {
      error: "Source is not part of these diagnostics",
    });
    return;
  }
  try {
    const source = await readFile(file, "utf-8");
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "x-content-type-options": "nosniff",
    });
    response.end(source);
  } catch {
    replyJson(response, 404, { error: "Source is unavailable" });
  }
};

export const diagnoseFile = async (
  file: string,
  options: CheckOptions
): Promise<PreviewDiagnosticData> => {
  const source = await readFile(file, "utf-8");
  return {
    checkedAt: new Date().toISOString(),
    diagnostics: await checkDocument(source, file, {
      ...options,
      projectComponents: true,
    }),
    file,
    source,
  };
};

export const handleDiagnosticsRequest = async (
  request: http.IncomingMessage,
  response: http.ServerResponse,
  data: () => PreviewDiagnosticData,
  recheck: () => Promise<void>
): Promise<void> => {
  if (!isLocalOrigin(request)) {
    replyJson(response, 403, { error: "Request origin is not allowed" });
    return;
  }
  if (request.method !== "GET" && request.method !== "POST") {
    replyJson(
      response,
      405,
      { error: "Method not allowed" },
      { allow: "GET, POST" }
    );
    return;
  }
  try {
    if (request.method === "POST") {
      await recheck();
    }
    replyJson(response, 200, data());
  } catch (error) {
    replyJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

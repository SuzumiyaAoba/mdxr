import type http from "node:http";

import { handleAgentRequest } from "./agent-http.js";
import { handleDocumentHistoryRequest } from "./document-history-http.js";
import { formatError } from "./format-error.js";
import {
  handleDiagnosticSourceRequest,
  handleDiagnosticsRequest,
} from "./preview-diagnostics.js";
import type {
  createPreviewDocument,
  PreviewTarget,
} from "./preview-document.js";
import { handleWorkspaceExportRequest } from "./workspace-export-data.js";
import { workspaceJs } from "./workspace-js.js";

interface PreviewRequestOptions {
  target: PreviewTarget;
  document: ReturnType<typeof createPreviewDocument>;
  recheck: () => Promise<void>;
  notifyAgent: () => void;
  subscribe: (req: http.IncomingMessage, res: http.ServerResponse) => void;
}

const handleWorkspaceScriptRequest = async (
  res: http.ServerResponse,
  target: PreviewTarget
): Promise<void> => {
  if (target.history === undefined) {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    const script = await workspaceJs();
    res.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "text/javascript; charset=utf-8",
      "x-content-type-options": "nosniff",
    });
    res.end(script);
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(formatError(error));
  }
};

/** Route preview requests without owning rendering or server lifecycle. */
export const createPreviewRequestHandler =
  ({
    target,
    document,
    recheck,
    notifyAgent,
    subscribe,
  }: PreviewRequestOptions) =>
  (req: http.IncomingMessage, res: http.ServerResponse): void => {
    const pathname = req.url?.split("?", 1)[0];
    if (pathname === "/__doc_diagnostics") {
      void handleDiagnosticsRequest(
        req,
        res,
        () => document.diagnostics,
        recheck
      );
      return;
    }
    if (pathname === "/__doc_diagnostic_source") {
      void handleDiagnosticSourceRequest(req, res, document.diagnostics);
      return;
    }
    if (pathname === "/__doc_file") {
      void target.filePreviews.handle(req, res);
      return;
    }
    if (req.url === "/__doc_workspace.js") {
      void handleWorkspaceScriptRequest(res, target);
      return;
    }
    if (req.url === "/__doc_agent") {
      void handleAgentRequest(req, res, target.agent, notifyAgent, async () => {
        await target.history?.capture(
          "before-instruction",
          document.dependencies()
        );
      });
      return;
    }
    if (req.url === "/__doc_events") {
      subscribe(req, res);
      return;
    }
    if (req.url?.startsWith("/__doc_history") === true) {
      void handleDocumentHistoryRequest(
        req,
        res,
        target.history,
        target.historyFile,
        target.configOptions
      );
      return;
    }
    if (pathname === "/__doc_export") {
      void handleWorkspaceExportRequest(
        req,
        res,
        target.historyFile,
        target.history,
        target.agent
      );
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(document.html);
  };

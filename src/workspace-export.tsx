import { Download } from "lucide-react";
import { useState } from "react";

import { collectWorkspaceBrowserState } from "./client/workspace-export-state.js";
import { captureWorkspaceDocument } from "./client/workspace-snapshot.js";
import { isRecord } from "./guards.js";
import { downloadText } from "./ui/data-download.js";
import type { WorkspaceExportData } from "./workspace-export-data.js";
import { workspaceExportAppendix } from "./workspace-export-html.js";

const isExportVersion = (value: unknown): boolean =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.contentHash === "string" &&
  typeof value.createdAt === "string" &&
  typeof value.sequence === "number" &&
  typeof value.size === "number" &&
  ["initial", "before-instruction", "change"].includes(String(value.kind)) &&
  typeof value.source === "string" &&
  Array.isArray(value.diff) &&
  value.diff.every(
    (line: unknown) =>
      isRecord(line) &&
      typeof line.text === "string" &&
      ["add", "remove", "context"].includes(String(line.type))
  );

const isExportConversation = (value: unknown): boolean =>
  value === null ||
  (isRecord(value) &&
    (value.provider === "codex" || value.provider === "claude") &&
    typeof value.busy === "boolean" &&
    (value.error === undefined || typeof value.error === "string") &&
    (value.sessionId === undefined || typeof value.sessionId === "string") &&
    Array.isArray(value.messages) &&
    value.messages.every(
      (message: unknown) =>
        isRecord(message) &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string"
    ));

const isExportData = (value: unknown): value is WorkspaceExportData =>
  isRecord(value) &&
  typeof value.file === "string" &&
  typeof value.exportedAt === "string" &&
  typeof value.latestId === "string" &&
  Array.isArray(value.versions) &&
  value.versions.length > 0 &&
  value.versions.every(isExportVersion) &&
  isExportConversation(value.conversation);

const loadExportData = async (): Promise<WorkspaceExportData> => {
  const response = await fetch("/__mdxr_export", { cache: "no-store" });
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      isRecord(data) && typeof data.error === "string"
        ? data.error
        : "Could not export this workspace"
    );
  }
  if (!isExportData(data)) {
    throw new Error("The workspace export is incomplete. Please retry.");
  }
  return data;
};

const exportWorkspace = async (): Promise<void> => {
  const state = collectWorkspaceBrowserState();
  const workspace = await loadExportData();
  // The appendix markup is built first, then captured inside the snapshot —
  // the export is the document itself with its archive appended, not a
  // wrapper page around it.
  const snapshot = await captureWorkspaceDocument({
    appendix: workspaceExportAppendix(workspace, state),
    title: `${document.title} — Workspace archive`,
  });
  const basename = workspace.file.split(/[\\/]/u).at(-1) ?? "workspace";
  const filename = `${basename.replace(/\.[^.]+$/u, "")}-workspace.html`;
  downloadText(snapshot, filename, "text/html;charset=utf-8");
};

export const WorkspaceExportButton = () => {
  const [status, setStatus] = useState<"idle" | "exporting" | "done" | "error">(
    "idle"
  );
  const [exportError, setExportError] = useState("");
  const statusMessage =
    status === "exporting"
      ? "Exporting workspace…"
      : "Workspace HTML downloaded.";
  const download = async (): Promise<void> => {
    setStatus("exporting");
    try {
      await exportWorkspace();
      setStatus("done");
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "Could not export this workspace"
      );
      setStatus("error");
    }
  };
  return (
    <>
      <button
        type="button"
        className="mdxr-workspace-export"
        aria-label="Export HTML"
        title="Export document, chat, comments and history as one HTML"
        disabled={status === "exporting"}
        onClick={() => {
          void download();
        }}
      >
        <Download aria-hidden="true" size={15} />
      </button>
      {status !== "idle" && (
        <div
          className="mdxr-workspace-export-status"
          role={status === "error" ? "alert" : "status"}
        >
          {status === "error" ? exportError : statusMessage}
          {status !== "exporting" && (
            <button
              type="button"
              aria-label="Dismiss export status"
              onClick={() => {
                setStatus("idle");
              }}
            >
              ×
            </button>
          )}
        </div>
      )}
    </>
  );
};

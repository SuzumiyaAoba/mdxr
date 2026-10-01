import { Dialog } from "@base-ui/react/dialog";
import { Download } from "lucide-react";
import { useId, useState } from "react";

import { collectWorkspaceBrowserState } from "./client/workspace-export-state.js";
import { captureWorkspaceDocument } from "./client/workspace-snapshot.js";
import { isRecord } from "./guards.js";
import { downloadText } from "./ui/data-download.js";
import type { WorkspaceExportData } from "./workspace-export-data.js";
import { workspaceExportAppendix } from "./workspace-export-html.js";
import { WORKSPACE_EXPORT_MODES } from "./workspace-export-options.js";
import type { WorkspaceExportMode } from "./workspace-export-options.js";

const EXPORT_LABELS = {
  document: {
    description: "The document as currently displayed, without review records.",
    label: "Document only",
    suffix: "document",
  },
  review: {
    description: "Document, current comments, section reviews and answers.",
    label: "Document and review",
    suffix: "review",
  },
  workspace: {
    description: "Document, chat, comments, drafts and all saved versions.",
    label: "All records",
    suffix: "workspace",
  },
} as const;

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
  value.versions.every(isExportVersion) &&
  isExportConversation(value.conversation);

const loadExportData = async (
  mode: WorkspaceExportMode
): Promise<WorkspaceExportData> => {
  const response = await fetch(`/__mdxr_export?mode=${mode}`, {
    cache: "no-store",
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      isRecord(data) && typeof data.error === "string"
        ? data.error
        : "Could not export this workspace"
    );
  }
  if (
    !isExportData(data) ||
    (mode === "workspace" && data.versions.length === 0)
  ) {
    throw new Error("The workspace export is incomplete. Please retry.");
  }
  return data;
};

const displayedDocumentPath = (): string => {
  try {
    return decodeURIComponent(window.location.pathname);
  } catch {
    return window.location.pathname;
  }
};

const exportWorkspace = async (
  mode: WorkspaceExportMode,
  includeRelated: boolean
): Promise<void> => {
  const workspace =
    mode === "document" ? undefined : await loadExportData(mode);
  const appendix =
    workspace === undefined
      ? undefined
      : workspaceExportAppendix(
          workspace,
          collectWorkspaceBrowserState(),
          mode
        );
  // The appendix markup is built first, then captured inside the snapshot —
  // the export is the document itself with its archive appended, not a
  // wrapper page around it.
  const snapshot = await captureWorkspaceDocument({
    appendix,
    includeRelated,
    includeReviews: mode !== "document",
    title:
      mode === "workspace"
        ? `${document.title} — Workspace archive`
        : document.title,
  });
  const file = workspace?.file ?? displayedDocumentPath();
  const basename = file.split(/[\\/]/u).at(-1) ?? "document";
  const filename = `${basename.replace(/\.[^.]+$/u, "")}-${EXPORT_LABELS[mode].suffix}.html`;
  downloadText(snapshot, filename, "text/html;charset=utf-8");
};

export const WorkspaceExportButton = () => {
  const modeId = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<WorkspaceExportMode>("workspace");
  const [includeRelated, setIncludeRelated] = useState(false);
  const [status, setStatus] = useState<"idle" | "exporting" | "done" | "error">(
    "idle"
  );
  const [exportError, setExportError] = useState("");
  const statusMessage =
    status === "exporting"
      ? "Exporting workspace…"
      : "Workspace HTML downloaded.";
  const download = async (): Promise<void> => {
    setOpen(false);
    setStatus("exporting");
    try {
      await exportWorkspace(mode, includeRelated);
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
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger
          className="mdxr-workspace-export"
          aria-label="Export HTML"
          title="Choose what to include in the HTML export"
          disabled={status === "exporting"}
        >
          <Download aria-hidden="true" size={15} />
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop className="mdxr-workspace-export-backdrop" />
          <Dialog.Popup className="mdxr-workspace-export-dialog">
            <Dialog.Title>Export HTML</Dialog.Title>
            <Dialog.Description>
              Choose the contents of the downloadable HTML file.
            </Dialog.Description>
            <fieldset>
              <legend>Export contents</legend>
              {WORKSPACE_EXPORT_MODES.map((option) => (
                <label key={option} aria-label={EXPORT_LABELS[option].label}>
                  <input
                    checked={mode === option}
                    name={modeId}
                    onChange={() => {
                      setMode(option);
                    }}
                    type="radio"
                    value={option}
                  />
                  <span>
                    <strong>{EXPORT_LABELS[option].label}</strong>
                    <span>{EXPORT_LABELS[option].description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <label>
              <input
                type="checkbox"
                checked={includeRelated}
                onChange={(event) => {
                  setIncludeRelated(event.target.checked);
                }}
              />{" "}
              Include related documents for offline reading
            </label>
            <div className="mdxr-workspace-export-actions">
              <Dialog.Close>Cancel</Dialog.Close>
              <button
                onClick={() => {
                  void download();
                }}
                type="button"
              >
                Download HTML
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
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

import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useRef, useState } from "react";

import type { DocumentDiagnostic } from "./check-diagnostics.js";
import { isDocumentDiagnostic } from "./check-diagnostics.js";
import { isRecord } from "./guards.js";
import type { PreviewDiagnosticData } from "./preview-diagnostics.js";

const readDiagnostics = async (
  method = "GET"
): Promise<PreviewDiagnosticData> => {
  const response = await fetch("/__doc_diagnostics", {
    cache: "no-store",
    method,
  });
  const value: unknown = await response.json();
  if (
    !response.ok ||
    !isRecord(value) ||
    !Array.isArray(value.diagnostics) ||
    typeof value.source !== "string" ||
    typeof value.file !== "string" ||
    typeof value.checkedAt !== "string" ||
    !value.diagnostics.every(isDocumentDiagnostic)
  ) {
    throw new Error("Could not load validation diagnostics");
  }
  return {
    checkedAt: value.checkedAt,
    diagnostics: value.diagnostics,
    file: value.file,
    source: value.source,
  };
};

const readDiagnosticSource = async (file: string): Promise<string> => {
  const response = await fetch(
    `/__doc_diagnostic_source?file=${encodeURIComponent(file)}`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error("Diagnostic source is unavailable");
  }
  return await response.text();
};

export const WorkspaceDiagnostics = () => {
  const [data, setData] = useState<PreviewDiagnosticData>();
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<DocumentDiagnostic>();
  const [source, setSource] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const request = useRef(0);
  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      try {
        const value = await readDiagnostics();
        if (active) {
          setData(value);
        }
      } catch {
        if (active) {
          setLoadError("Diagnostics are unavailable");
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (selected === undefined || field.current === null) {
      return;
    }
    const lines = source.split("\n");
    const start =
      lines
        .slice(0, selected.line - 1)
        .reduce((length, line) => length + line.length + 1, 0) +
      selected.column -
      1;
    field.current.focus();
    field.current.setSelectionRange(start, Math.min(source.length, start + 1));
    field.current.scrollTop = Math.max(0, (selected.line - 3) * 20);
  }, [selected, source]);
  const show = async (diagnostic: DocumentDiagnostic): Promise<void> => {
    request.current += 1;
    const generation = request.current;
    try {
      const text = await readDiagnosticSource(diagnostic.file);
      if (generation === request.current) {
        setSource(text);
        setSelected(diagnostic);
        setLoadError("");
      }
    } catch (error) {
      if (generation === request.current) {
        setLoadError(error instanceof Error ? error.message : String(error));
      }
    }
  };
  const recheck = async (): Promise<void> => {
    try {
      setData(await readDiagnostics("POST"));
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  };
  const errors =
    data?.diagnostics.filter(({ severity }) => severity === "error").length ??
    0;
  const warnings = (data?.diagnostics.length ?? 0) - errors;
  return (
    <Dialog.Root>
      <Dialog.Trigger
        className="doc-workspace-export"
        aria-label="Validation diagnostics"
        title={`${errors} errors, ${warnings} warnings`}
      >
        Check {errors + warnings}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="doc-workspace-export-backdrop" />
        <Dialog.Popup className="doc-workspace-export-dialog doc-workspace-diagnostics">
          <Dialog.Title>Validation diagnostics</Dialog.Title>
          <Dialog.Description>
            {errors} errors, {warnings} warnings. Select a diagnostic to view
            its source location.
          </Dialog.Description>
          <button
            type="button"
            onClick={() => {
              void recheck();
            }}
          >
            Recheck
          </button>
          {loadError !== "" && <p role="alert">{loadError}</p>}
          <ul>
            {data?.diagnostics.map((diagnostic, index) => (
              <li
                key={`${diagnostic.file}:${diagnostic.line}:${diagnostic.column}:${diagnostic.code}:${index}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    void show(diagnostic);
                  }}
                >
                  {diagnostic.severity}: {diagnostic.file}:{diagnostic.line}:
                  {diagnostic.column} [{diagnostic.code}] {diagnostic.message}
                  {diagnostic.suggestion === undefined
                    ? ""
                    : ` Suggestion: ${diagnostic.suggestion}`}
                </button>
              </li>
            ))}
          </ul>
          {selected !== undefined && (
            <label>
              Raw MDX: {selected.file}:{selected.line}:{selected.column}
              <textarea
                ref={field}
                readOnly
                value={source}
                rows={18}
                style={{
                  fontFamily: "monospace",
                  lineHeight: "20px",
                  whiteSpace: "pre",
                  width: "100%",
                }}
              />
            </label>
          )}
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

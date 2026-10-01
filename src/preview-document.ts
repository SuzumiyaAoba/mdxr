import { injectAgentPreview } from "./agent-preview.js";
import type { AgentProvider, createAgentSession } from "./agent-session.js";
import { errorDiagnostic } from "./check-diagnostics.js";
import type { ConfigOptions } from "./config.js";
import type { createDocumentHistory } from "./document-history.js";
import type { createFilePreviews } from "./file-preview-http.js";
import { formatError } from "./format-error.js";
import type { PreviewDiagnosticData } from "./preview-diagnostics.js";

export interface PreviewTarget {
  filePreviews: ReturnType<typeof createFilePreviews>;
  /** Label shown in the startup log. */
  label: string;
  /** Re-render the document; errors are served as an error page. */
  renderDoc: () => Promise<string>;
  /** Dependency files the last render pulled in (theme CSS + its imports). */
  deps?: () => string[];
  /** Directory watched for changes (config, components, theme, sources). */
  watchDir: string;
  /** Non-recursive fallback watch target (the document file). */
  watchFile?: string;
  agent?: ReturnType<typeof createAgentSession>;
  agentProvider?: AgentProvider;
  history?: ReturnType<typeof createDocumentHistory>;
  historyFile?: string;
  configOptions?: ConfigOptions;
  diagnose?: () => Promise<PreviewDiagnosticData>;
  diagnosticDependencies?: () => string[];
}

const errorPage = (error: unknown): string =>
  `<!doctype html><meta charset="utf-8"><body style="font-family:monospace;background:#1c1917;color:#fca5a5;padding:2rem"><h1>mdxr render error</h1><pre>${formatError(error).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</pre></body>`;

const withWorkspace = (html: string, target: PreviewTarget): string =>
  target.history === undefined
    ? html
    : injectAgentPreview(html, target.agentProvider);

/** Keep the rendered document, diagnostics and version history together. */
export const createPreviewDocument = (target: PreviewTarget) => {
  let html = "";
  let capturedInitialVersion = false;
  let diagnostics: PreviewDiagnosticData = {
    checkedAt: new Date().toISOString(),
    diagnostics: [],
    file: target.label,
    source: "",
  };
  const dependencies = (): string[] => [
    ...(target.deps?.() ?? []),
    ...(target.diagnosticDependencies?.() ?? []),
  ];

  return {
    dependencies,
    get diagnostics(): PreviewDiagnosticData {
      return diagnostics;
    },
    get html(): string {
      return html;
    },
    async rebuild(): Promise<void> {
      try {
        if (target.diagnose !== undefined) {
          diagnostics = await target.diagnose();
        }
        const rendered = await target.renderDoc();
        html = withWorkspace(rendered, target);
      } catch (error) {
        if (
          !diagnostics.diagnostics.some(({ severity }) => severity === "error")
        ) {
          diagnostics.diagnostics.push(
            errorDiagnostic(
              target.historyFile ?? target.label,
              error,
              "mdxr:render"
            )
          );
        }
        const page = `${errorPage(error)}<script>new EventSource('/__mdxr_events').addEventListener('reload',()=>location.reload())</script>`;
        html = withWorkspace(page, target);
      }
      if (target.history !== undefined) {
        try {
          await target.history.capture(
            capturedInitialVersion ? "change" : "initial",
            dependencies()
          );
          capturedInitialVersion = true;
        } catch (error) {
          diagnostics.diagnostics.push(
            errorDiagnostic(
              target.historyFile ?? target.label,
              error,
              "mdxr:history"
            )
          );
        }
      }
    },
  };
};

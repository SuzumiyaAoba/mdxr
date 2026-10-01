import { once } from "node:events";
import http from "node:http";
import path from "node:path";

import { handleAgentRequest } from "./agent-http.js";
import { validateAgentOptions } from "./agent-options.js";
import { injectAgentPreview } from "./agent-preview.js";
import { createAgentSession } from "./agent-session.js";
import type { AgentProvider } from "./agent-session.js";
import { errorDiagnostic } from "./check-diagnostics.js";
import type { ConfigOptions } from "./config.js";
import { handleDocumentHistoryRequest } from "./document-history-http.js";
import { createDocumentHistory } from "./document-history.js";
import { createFilePreviews } from "./file-preview-http.js";
import { formatError } from "./format-error.js";
import { openInBrowser } from "./open.js";
import {
  diagnoseFile,
  handleDiagnosticSourceRequest,
  handleDiagnosticsRequest,
} from "./preview-diagnostics.js";
import type { PreviewDiagnosticData } from "./preview-diagnostics.js";
import { createPreviewWatcher } from "./preview-watch.js";
import type { RenderSourceOptions } from "./render.js";
import { render, renderFile } from "./render.js";
import { handleWorkspaceExportRequest } from "./workspace-export-data.js";
import { workspaceJs } from "./workspace-js.js";

const errorPage = (err: unknown): string =>
  `<!doctype html><meta charset="utf-8"><body style="font-family:monospace;background:#1c1917;color:#fca5a5;padding:2rem"><h1>mdxr render error</h1><pre>${formatError(err).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</pre></body>`;

interface PreviewTarget {
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

const previewDependencies = (target: PreviewTarget): string[] => [
  ...(target.deps?.() ?? []),
  ...(target.diagnosticDependencies?.() ?? []),
];
const withWorkspace = (html: string, target: PreviewTarget): string =>
  target.history === undefined
    ? html
    : injectAgentPreview(html, target.agentProvider);

/** Upper bound on consecutive EADDRINUSE retries before give-up. */
const MAX_PORT_ATTEMPTS = 100;

/**
 * Bind `server` on loopback to `port`, or to the next free port after it —
 * a probe-then-bind helper would just race the real listen. Port 0 already
 * asks the OS for a port, so it binds once and never retries.
 */
export const listenOnFreePort = async (
  server: http.Server,
  port: number
): Promise<void> => {
  for (let attempt = 0; ; attempt += 1) {
    const candidate = port + attempt;
    try {
      server.listen(candidate, "127.0.0.1");
      // Ports are probed strictly in order — the next candidate is only
      // tried after the previous one refused with EADDRINUSE.
      // oxlint-disable-next-line no-await-in-loop
      await once(server, "listening");
      if (attempt > 0) {
        console.log(`mdxr: port ${port} is taken, using ${candidate}`);
      }
      return;
    } catch (error) {
      const busy =
        error instanceof Error &&
        (error as NodeJS.ErrnoException).code === "EADDRINUSE";
      if (
        !busy ||
        port === 0 ||
        attempt >= MAX_PORT_ATTEMPTS ||
        candidate >= 65_535
      ) {
        throw error;
      }
    }
  }
};

const handleDocumentResponse = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  target: PreviewTarget,
  html: string
): void => {
  if (req.url?.startsWith("/__mdxr_history") === true) {
    void handleDocumentHistoryRequest(
      req,
      res,
      target.history,
      target.historyFile,
      target.configOptions
    );
    return;
  }
  if (req.url?.split("?")[0] === "/__mdxr_export") {
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
  res.end(html);
};

const broadcast = (
  clients: Set<http.ServerResponse>,
  event: "agent" | "reload"
): void => {
  for (const client of clients) {
    try {
      client.write(`event: ${event}\ndata: {}\n\n`);
    } catch {
      clients.delete(client);
    }
  }
};

const servePreview = async (
  target: PreviewTarget,
  port: number
): Promise<http.Server> => {
  let html = "";
  let closed = false;
  let capturedInitialVersion = false;
  let diagnostics: PreviewDiagnosticData = {
    checkedAt: new Date().toISOString(),
    diagnostics: [],
    file: target.label,
    source: "",
  };
  const clients = new Set<http.ServerResponse>();
  const notifyAgent = (): void => {
    broadcast(clients, "agent");
  };
  target.agent?.setOnUpdate(notifyAgent);

  const rebuild = async (
    watcher: ReturnType<typeof createPreviewWatcher>
  ): Promise<void> => {
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
      const page = `${errorPage(error).replace("</body>", "")}<script>new EventSource('/__mdxr_events').addEventListener('reload',()=>location.reload())</script>`;
      html = withWorkspace(page, target);
    }
    if (target.history !== undefined) {
      try {
        await target.history.capture(
          capturedInitialVersion ? "change" : "initial",
          previewDependencies(target)
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
    if (!closed) {
      watcher.armDependencies(previewDependencies(target));
    }
  };

  // Rebuilds chain onto each other: a change burst during a slow rebuild
  // can't interleave two renders or serve an older result last. Every link
  // swallows its own errors, so the stored tail can never reject — nothing
  // awaits it, and an unhandled rejection would take the server down.
  let reloading: Promise<void> = Promise.resolve();
  const reload = (watcher: ReturnType<typeof createPreviewWatcher>): void => {
    const prev = reloading;
    reloading = (async () => {
      await prev;
      if (closed) {
        return;
      }
      try {
        await rebuild(watcher);
        broadcast(clients, "reload");
      } catch {
        // Notified clients are best-effort; rebuild failures are already
        // rendered into the error page by rebuild() itself.
      }
    })();
  };

  const watcher = createPreviewWatcher(target, () => {
    reload(watcher);
  });
  const server = http.createServer((req, res) => {
    if (req.url?.split("?")[0] === "/__mdxr_diagnostics") {
      void handleDiagnosticsRequest(
        req,
        res,
        () => diagnostics,
        async () => {
          const previous = reloading;
          reloading = (async () => {
            await previous;
            if (!closed) {
              await rebuild(watcher);
            }
          })();
          await reloading;
        }
      );
      return;
    }
    if (req.url?.split("?")[0] === "/__mdxr_diagnostic_source") {
      void handleDiagnosticSourceRequest(req, res, diagnostics);
      return;
    }
    if (req.url?.split("?")[0] === "/__mdxr_file") {
      void target.filePreviews.handle(req, res);
      return;
    }
    if (req.url === "/__mdxr_workspace.js") {
      if (target.history === undefined) {
        res.writeHead(404);
        res.end();
        return;
      }
      void (async () => {
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
      })();
      return;
    }
    if (req.url === "/__mdxr_agent") {
      void handleAgentRequest(req, res, target.agent, notifyAgent, async () => {
        await target.history?.capture(
          "before-instruction",
          previewDependencies(target)
        );
      });
      return;
    }
    if (req.url === "/__mdxr_events") {
      res.writeHead(200, {
        "cache-control": "no-cache",
        connection: "keep-alive",
        "content-type": "text/event-stream",
      });
      res.write("retry: 1000\n\n");
      clients.add(res);
      req.on("close", () => {
        clients.delete(res);
      });
      res.on("error", () => {
        clients.delete(res);
      });
      return;
    }
    handleDocumentResponse(req, res, target, html);
  });
  const closeAgent = async (): Promise<void> => {
    try {
      await target.agent?.close();
    } catch {
      // The preview is already closed; there is no client to report to.
    }
  };
  server.on("close", () => {
    closed = true;
    watcher.close();
    void closeAgent();
  });

  // Edits during startup must wait for the initial render too.
  reloading = rebuild(watcher);
  await reloading;
  // Bind loopback only — the startup log says localhost, and a preview
  // server has no auth: listening on 0.0.0.0 would expose the document
  // (and its file links) to the LAN.
  try {
    await listenOnFreePort(server, port);
  } catch (error) {
    // Close fires the 'close' handler above — without it a failed listen
    // would leave the watchers armed and keep the process alive.
    server.close();
    throw error;
  }

  const address = server.address();
  const boundPort =
    typeof address === "object" && address !== null ? address.port : port;
  console.log(`mdxr: serving ${target.label} at http://localhost:${boundPort}`);
  console.log("mdxr: watching for changes (Ctrl+C to stop)");
  return server;
};

/** Open a listening preview server's localhost URL in the default browser. */
const openPreview = async (
  server: http.Server,
  port: number
): Promise<void> => {
  const address = server.address();
  const boundPort =
    typeof address === "object" && address !== null ? address.port : port;
  await openInBrowser(`http://localhost:${boundPort}`);
};

/**
 * Wraps a render fn with dependency tracking: `deps` reads the paths the
 * last render reported via `onDependencies` (theme CSS + its imports), so
 * the watcher can track files outside the document's own directory.
 */
const trackDeps = (
  renderDoc: (onDeps: (paths: string[]) => void) => Promise<string>
): Pick<PreviewTarget, "deps" | "renderDoc"> => {
  let deps: string[] = [];
  return {
    deps: () => deps,
    renderDoc: async () => {
      const collected: string[] = [];
      const doc = await renderDoc((d) => {
        collected.push(...d);
      });
      deps = collected;
      return doc;
    },
  };
};

/** Options for {@link serve} and {@link serveSource}. */
export interface ServeOptions extends Omit<
  RenderSourceOptions,
  "filePreview" | "liveReload" | "onDependencies"
> {
  /** Open the preview URL in the default browser once the server is listening. */
  open?: boolean;
  /** Show a local chat panel backed by a live Codex or Claude session. */
  agent?: AgentProvider;
  /** Existing Codex thread to contact through its App Server. */
  session?: string;
  /** Optional Codex App Server WebSocket or Unix socket endpoint. */
  server?: string;
}

/** Serve an .mdx file, rebuilding + live-reloading on changes in its directory. */
export const serve = async (
  mdxPath: string,
  port: number,
  opts: Pick<
    ServeOptions,
    "open" | "agent" | "session" | "server" | "config" | "project"
  > = {}
): Promise<http.Server> => {
  validateAgentOptions(opts.agent, opts.session, opts.server);
  const abs = path.resolve(mdxPath);
  const history = createDocumentHistory(abs);
  const filePreviews = createFilePreviews();
  let diagnosticDependencies: string[] = [];
  const server = await servePreview(
    {
      agent:
        opts.agent === undefined
          ? undefined
          : createAgentSession(abs, opts.agent, opts.session, opts.server),
      agentProvider: opts.agent,
      configOptions: { config: opts.config, project: opts.project },
      diagnose: async () => {
        diagnosticDependencies = [];
        return await diagnoseFile(abs, {
          ...opts,
          onDependencies: (files) => {
            diagnosticDependencies.push(...files);
          },
        });
      },
      diagnosticDependencies: () => diagnosticDependencies,
      filePreviews,
      history,
      historyFile: abs,
      label: mdxPath,
      ...trackDeps(
        async (onDeps) =>
          await renderFile(abs, {
            config: opts.config,
            filePreview: filePreviews.register,
            inlineAssets: true,
            liveReload: true,
            onDependencies: onDeps,
            project: opts.project,
          })
      ),
      watchDir: path.dirname(abs),
      watchFile: abs,
    },
    port
  );
  if (opts.open === true) {
    await openPreview(server, port);
  }
  return server;
};

/** Serve MDX source passed directly (e.g. piped via stdin). */
export const serveSource = async (
  source: string,
  port: number,
  opts: ServeOptions = {}
): Promise<http.Server> => {
  if (
    opts.agent !== undefined ||
    opts.session !== undefined ||
    opts.server !== undefined
  ) {
    throw new Error("Agent chat requires an MDX file");
  }
  const dir = path.resolve(opts.dir ?? process.cwd());
  const filePreviews = createFilePreviews();
  const server = await servePreview(
    {
      filePreviews,
      label: opts.filePath ?? "stdin",
      ...trackDeps(
        async (onDeps) =>
          await render(source, {
            dir,
            documentControls: opts.documentControls,
            filePath: opts.filePath,
            filePreview: filePreviews.register,
            hydrate: opts.hydrate,
            initialTheme: opts.initialTheme,
            inlineAssets: opts.inlineAssets ?? true,
            liveReload: true,
            onDependencies: onDeps,
          })
      ),
      watchDir: dir,
    },
    port
  );
  if (opts.open === true) {
    await openPreview(server, port);
  }
  return server;
};

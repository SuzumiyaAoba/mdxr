import { once } from "node:events";
import http from "node:http";
import path from "node:path";

import { validateAgentOptions } from "./agent-options.js";
import { createAgentSession } from "./agent-session.js";
import type { AgentProvider } from "./agent-session.js";
import { createDocumentHistory } from "./document-history.js";
import { createFilePreviews } from "./file-preview-http.js";
import { openInBrowser } from "./open.js";
import { diagnoseFile } from "./preview-diagnostics.js";
import { createPreviewDocument } from "./preview-document.js";
import type { PreviewTarget } from "./preview-document.js";
import { createPreviewRequestHandler } from "./preview-http.js";
import { createPreviewWatcher } from "./preview-watch.js";
import type { RenderSourceOptions } from "./render.js";
import { render, renderFile } from "./render.js";
import { closePreviewServer, createServerLifetime } from "./serve-lifetime.js";
import type { ServerLifetimeOptions } from "./serve-lifetime.js";

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
  port: number,
  options: ServerLifetimeOptions
): Promise<http.Server> => {
  let closed = false;
  const server = http.createServer();
  const lifetime = createServerLifetime(server, options);
  const document = createPreviewDocument(target);
  const clients = new Set<http.ServerResponse>();
  let releaseAgent: (() => void) | undefined;
  const notifyAgent = (busy?: boolean): void => {
    if (busy === true) {
      releaseAgent ??= lifetime.hold();
    } else if (busy === false) {
      releaseAgent?.();
      releaseAgent = undefined;
    }
    broadcast(clients, "agent");
  };
  target.agent?.setOnUpdate(notifyAgent);

  // Source edits and diagnostic rechecks share one queue so a slow rebuild
  // cannot overwrite a newer result. Keep the stored tail fulfilled while
  // returning each operation's failure to its caller.
  let reloading: Promise<void> = Promise.resolve();
  const rebuild = async (
    watcher: ReturnType<typeof createPreviewWatcher>,
    notify = false
  ): Promise<void> => {
    const previous = reloading;
    const pending = (async () => {
      await previous;
      if (closed) {
        return;
      }
      await document.rebuild();
      if (!closed) {
        watcher.armDependencies(document.dependencies());
      }
      if (notify) {
        broadcast(clients, "reload");
      }
    })();
    reloading = (async () => {
      try {
        await pending;
      } catch {
        // Keep later updates queued even if dependency watching fails.
      }
    })();
    await pending;
  };

  const watcher = createPreviewWatcher(target, () => {
    void (async () => {
      try {
        await rebuild(watcher, true);
      } catch {
        // Render and history failures are already reported in diagnostics.
      }
    })();
  });
  server.on(
    "request",
    createPreviewRequestHandler({
      document,
      notifyAgent,
      recheck: async () => {
        await rebuild(watcher);
      },
      subscribe: (req, res) => {
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
      },
      target,
    })
  );
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
    releaseAgent?.();
    void closeAgent();
  });

  // Bind loopback only — the startup log says localhost, and a preview
  // server has no auth: listening on 0.0.0.0 would expose the document
  // (and its file links) to the LAN.
  try {
    // Edits during startup must wait for the initial render too.
    await rebuild(watcher);
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
  try {
    await openInBrowser(`http://localhost:${boundPort}`);
  } catch (error) {
    closePreviewServer(server);
    throw error;
  }
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
export interface ServeOptions
  extends
    Omit<RenderSourceOptions, "filePreview" | "liveReload" | "onDependencies">,
    ServerLifetimeOptions {
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
    | "open"
    | "agent"
    | "session"
    | "server"
    | "config"
    | "project"
    | "idleTimeout"
    | "parentLifetime"
  > = {}
): Promise<http.Server> => {
  validateAgentOptions(opts.agent, opts.session, opts.server);
  const abs = path.resolve(mdxPath);
  const history = createDocumentHistory(abs);
  const filePreviews = createFilePreviews({
    config: opts.config,
    project: opts.project,
  });
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
    port,
    opts
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
  const filePreviews = createFilePreviews({
    config: opts.config,
    project: opts.project,
  });
  const server = await servePreview(
    {
      filePreviews,
      label: opts.filePath ?? "stdin",
      ...trackDeps(
        async (onDeps) =>
          await render(source, {
            config: opts.config,
            dir,
            documentControls: opts.documentControls,
            filePath: opts.filePath,
            filePreview: filePreviews.register,
            hydrate: opts.hydrate,
            initialTheme: opts.initialTheme,
            inlineAssets: opts.inlineAssets ?? true,
            liveReload: true,
            onDependencies: onDeps,
            project: opts.project,
          })
      ),
      watchDir: dir,
    },
    port,
    opts
  );
  if (opts.open === true) {
    await openPreview(server, port);
  }
  return server;
};

import { once } from "node:events";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { formatError } from "./format-error.js";
import type { RenderSourceOptions } from "./render.js";
import { render, renderFile } from "./render.js";

const errorPage = (err: unknown): string =>
  `<!doctype html><meta charset="utf-8"><body style="font-family:monospace;background:#1c1917;color:#fca5a5;padding:2rem"><h1>mdxr render error</h1><pre>${formatError(err).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</pre></body>`;

interface PreviewTarget {
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
}

/** Dependency/build output dirs — never worth a watch fd. */
const SKIP_DIRS = new Set([
  ".git",
  ".mdxr-cache",
  "dist",
  "node_modules",
  "storybook-static",
]);

/**
 * The set of directories being watched. `fs.watch` recursive mode exists only
 * on darwin/win32 — elsewhere `arm` puts one non-recursive watcher per
 * directory, which also survives atomic saves (rename-over kills a watch
 * aimed at the file itself).
 */
const createWatchSet = () => {
  const watchers: fs.FSWatcher[] = [];
  const armed = new Set<string>();

  const track = (w: fs.FSWatcher, dir?: string): void => {
    watchers.push(w);
    if (dir !== undefined) {
      armed.add(dir);
      // A deleted dir kills its watcher — un-arm on close so a recreated
      // dir is picked up again by the next event's re-scan.
      w.on("close", () => {
        armed.delete(dir);
      });
    }
    w.on("error", () => {
      w.close();
    });
  };

  /** One watcher on `dir` itself (no descent). */
  const armFlat = (dir: string, onEvent: () => void): void => {
    if (armed.has(dir) || SKIP_DIRS.has(path.basename(dir))) {
      return;
    }
    try {
      track(fs.watch(dir, onEvent), dir);
    } catch {
      // Directory gone or unwatched — skip.
    }
  };

  /**
   * Recursive fallback: a watcher on `dir` plus every directory under it.
   * The `armed` check guards only the watcher install — the descent still
   * runs on an already-armed root, so directories created mid-session get
   * picked up on the next rebuild (armDeps re-arms the tree for this).
   */
  const arm = (dir: string, onEvent: () => void): void => {
    if (SKIP_DIRS.has(path.basename(dir))) {
      return;
    }
    if (!armed.has(dir)) {
      try {
        track(fs.watch(dir, onEvent), dir);
      } catch {
        // Watch failed (dir gone, fd limit) — children may still be
        // watchable, so keep descending.
      }
    }
    let ents: fs.Dirent[];
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      if (e.isDirectory()) {
        arm(path.join(dir, e.name), onEvent);
      }
    }
  };

  return {
    arm,
    armFlat,
    close(): void {
      for (const w of watchers) {
        w.close();
      }
    },
    get size(): number {
      return watchers.length;
    },
    track,
  };
};

const servePreview = async (
  target: PreviewTarget,
  port: number
): Promise<http.Server> => {
  let html = "";
  const clients = new Set<http.ServerResponse>();
  const server = http.createServer((req, res) => {
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
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });

  const watch = createWatchSet();
  let recursiveWatch = false;
  let timer: NodeJS.Timeout | undefined;

  /**
   * Dependency files (theme CSS, its nested imports) may live outside the
   * watched document directory. Inside the watch dir the root watcher covers
   * them; outside, a flat watcher on the file's own directory suffices —
   * and avoids descending into a potentially huge ancestor tree. Also
   * re-arms the tree so directories created mid-session are picked up.
   */
  const armDeps = (onEvent: () => void): void => {
    if (!recursiveWatch) {
      watch.arm(target.watchDir, onEvent);
    }
    for (const dep of target.deps?.() ?? []) {
      const dir = path.dirname(dep);
      const inside =
        dir === target.watchDir ||
        dir.startsWith(`${target.watchDir}${path.sep}`);
      if (inside || dir.split(path.sep).includes("node_modules")) {
        continue;
      }
      watch.armFlat(dir, onEvent);
    }
  };

  const rebuild = async (onEvent: () => void): Promise<void> => {
    try {
      html = await target.renderDoc();
    } catch (error) {
      html = errorPage(error);
    }
    armDeps(onEvent);
  };

  // Rebuilds chain onto each other: a change burst during a slow rebuild
  // can't interleave two renders or serve an older result last. Every link
  // swallows its own errors, so the stored tail can never reject — nothing
  // awaits it, and an unhandled rejection would take the server down.
  let reloading: Promise<void> = Promise.resolve();
  const reload = (onEvent: () => void): void => {
    const prev = reloading;
    reloading = (async () => {
      await prev;
      try {
        await rebuild(onEvent);
        for (const c of clients) {
          try {
            c.write("event: reload\ndata: {}\n\n");
          } catch {
            clients.delete(c);
          }
        }
      } catch {
        // Notified clients are best-effort; rebuild failures are already
        // rendered into the error page by rebuild() itself.
      }
    })();
  };

  const notify = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      reload(notify);
    }, 80);
  };

  // fs.watch recursive mode exists only on darwin/win32; elsewhere `arm`
  // installs the per-directory fallback.
  try {
    watch.track(fs.watch(target.watchDir, { recursive: true }, notify));
    recursiveWatch = true;
  } catch {
    watch.arm(target.watchDir, notify);
  }
  if (watch.size === 0 && target.watchFile !== undefined) {
    try {
      watch.track(fs.watch(target.watchFile, notify));
    } catch {
      // Live reload just won't fire; the server still serves the document.
    }
  }
  server.on("close", () => {
    clearTimeout(timer);
    watch.close();
  });

  await rebuild(notify);

  // Bind loopback only — the startup log says localhost, and a preview
  // server has no auth: listening on 0.0.0.0 would expose the document
  // (and its file links) to the LAN.
  server.listen(port, "127.0.0.1");
  try {
    // Rejects on 'error' (e.g. EADDRINUSE) before 'listening'.
    await once(server, "listening");
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

/** Serve an .mdx file, rebuilding + live-reloading on changes in its directory. */
export const serve = async (
  mdxPath: string,
  port: number
): Promise<http.Server> => {
  const abs = path.resolve(mdxPath);
  let deps: string[] = [];
  return await servePreview(
    {
      deps: () => deps,
      label: mdxPath,
      renderDoc: async () => {
        const collected: string[] = [];
        const doc = await renderFile(abs, {
          liveReload: true,
          onDependencies: (d) => {
            collected.push(...d);
          },
        });
        deps = collected;
        return doc;
      },
      watchDir: path.dirname(abs),
      watchFile: abs,
    },
    port
  );
};

/** Serve MDX source passed directly (e.g. piped via stdin). */
export const serveSource = async (
  source: string,
  port: number,
  opts: Omit<RenderSourceOptions, "liveReload" | "onDependencies"> = {}
): Promise<http.Server> => {
  const dir = path.resolve(opts.dir ?? process.cwd());
  let deps: string[] = [];
  return await servePreview(
    {
      deps: () => deps,
      label: opts.filePath ?? "stdin",
      renderDoc: async () => {
        const collected: string[] = [];
        const doc = await render(source, {
          dir,
          filePath: opts.filePath,
          liveReload: true,
          onDependencies: (d) => {
            collected.push(...d);
          },
        });
        deps = collected;
        return doc;
      },
      watchDir: dir,
    },
    port
  );
};

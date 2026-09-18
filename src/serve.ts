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

const servePreview = async (
  target: PreviewTarget,
  port: number
): Promise<http.Server> => {
  let html = "";
  const rebuild = async () => {
    try {
      html = await target.renderDoc();
    } catch (error) {
      html = errorPage(error);
    }
  };
  await rebuild();

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

  // Rebuilds chain onto each other: a change burst during a slow rebuild
  // can't interleave two renders or serve an older result last. Every link
  // swallows its own errors, so the stored tail can never reject — nothing
  // awaits it, and an unhandled rejection would take the server down.
  let reloading: Promise<void> = Promise.resolve();
  const reload = (): void => {
    const prev = reloading;
    reloading = (async () => {
      await prev;
      try {
        await rebuild();
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

  const watchers: fs.FSWatcher[] = [];
  const armed = new Set<string>();
  /** Non-recursive fallback: one watcher per directory under `root`. */
  const arm = (dir: string, onEvent: () => void): void => {
    if (armed.has(dir) || SKIP_DIRS.has(path.basename(dir))) {
      return;
    }
    let w: fs.FSWatcher;
    try {
      w = fs.watch(dir, onEvent);
    } catch {
      return;
    }
    watchers.push(w);
    armed.add(dir);
    // A deleted dir kills its watcher — un-arm on close so a recreated dir
    // gets picked up again by the next event's re-scan.
    w.on("error", () => {
      w.close();
    });
    w.on("close", () => {
      armed.delete(dir);
    });
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

  let recursiveWatch = false;
  let timer: NodeJS.Timeout | undefined;
  const notify = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!recursiveWatch) {
        // Pick up directories created mid-session.
        arm(target.watchDir, notify);
      }
      reload();
    }, 80);
  };

  // fs.watch recursive mode exists only on darwin/win32. Elsewhere we arm one
  // non-recursive watcher per directory — which also covers atomic saves
  // (rename-over-file kills a watch aimed at the file itself).
  try {
    const w = fs.watch(target.watchDir, { recursive: true }, notify);
    w.on("error", () => {
      w.close();
    });
    watchers.push(w);
    recursiveWatch = true;
  } catch {
    arm(target.watchDir, notify);
  }
  if (watchers.length === 0 && target.watchFile !== undefined) {
    try {
      const w = fs.watch(target.watchFile, notify);
      w.on("error", () => {
        w.close();
      });
      watchers.push(w);
    } catch {
      // Live reload just won't fire; the server still serves the document.
    }
  }
  server.on("close", () => {
    clearTimeout(timer);
    for (const w of watchers) {
      w.close();
    }
  });

  server.listen(port);
  // Rejects on 'error' (e.g. EADDRINUSE) before 'listening'.
  await once(server, "listening");

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
  return await servePreview(
    {
      label: mdxPath,
      renderDoc: async () => await renderFile(abs, { liveReload: true }),
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
  opts: Omit<RenderSourceOptions, "liveReload"> = {}
): Promise<http.Server> => {
  const dir = path.resolve(opts.dir ?? process.cwd());
  return await servePreview(
    {
      label: opts.filePath ?? "stdin",
      renderDoc: async () =>
        await render(source, {
          dir,
          filePath: opts.filePath,
          liveReload: true,
        }),
      watchDir: dir,
    },
    port
  );
};

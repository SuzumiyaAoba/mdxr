import { once } from "node:events";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { formatError } from "./format-error.js";
import type { RenderSourceOptions } from "./render.js";
import { render, renderFile } from "./render.js";

const errorPage = (err: unknown): string =>
  `<!doctype html><meta charset="utf-8"><body style="font-family:monospace;background:#1c1917;color:#fca5a5;padding:2rem"><h1>mdxr render error</h1><pre>${formatError(err).replaceAll("<", "&lt;")}</pre></body>`;

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
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });

  const reload = async () => {
    await rebuild();
    for (const c of clients) {
      c.write("event: reload\ndata: {}\n\n");
    }
  };
  let timer: NodeJS.Timeout | undefined;
  const notify = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void reload();
    }, 80);
  };

  const recursive =
    process.platform === "darwin" || process.platform === "win32";
  let watcher: fs.FSWatcher | undefined;
  try {
    watcher = fs.watch(target.watchDir, { recursive }, notify);
  } catch {
    try {
      watcher = fs.watch(target.watchFile ?? target.watchDir, notify);
    } catch {
      watcher = undefined;
    }
  }
  server.on("close", () => {
    watcher?.close();
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

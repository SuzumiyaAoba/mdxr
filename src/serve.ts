import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { renderFile } from "./render.js";

const errorPage = (err: unknown): string => {
  const msg = err instanceof Error ? err.message : String(err);
  return `<!doctype html><meta charset="utf-8"><body style="font-family:monospace;background:#1c1917;color:#fca5a5;padding:2rem"><h1>rv render error</h1><pre>${msg.replaceAll("<", "&lt;")}</pre></body>`;
};

export const serve = async (mdxPath: string, port: number): Promise<void> => {
  const abs = path.resolve(mdxPath);
  const dir = path.dirname(abs);

  let html = "";
  const rebuild = async () => {
    try {
      html = await renderFile(abs, { liveReload: true });
    } catch (error) {
      html = errorPage(error);
    }
  };
  await rebuild();

  const clients = new Set<http.ServerResponse>();
  const server = http.createServer((req, res) => {
    if (req.url === "/__rv_events") {
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
  try {
    fs.watch(dir, { recursive }, notify);
  } catch {
    fs.watch(abs, notify);
  }

  server.listen(port, () => {
    console.log(`rv: serving ${mdxPath} at http://localhost:${port}`);
    console.log("rv: watching for changes (Ctrl+C to stop)");
  });
};

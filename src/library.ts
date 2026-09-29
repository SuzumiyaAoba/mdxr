import http from "node:http";

import { formatError } from "./format-error.js";
import { createLibraryIndex } from "./library-index.js";
import { libraryHtml, libraryJs } from "./library-page.js";
import type { LibrarySort } from "./library-types.js";
import { openInBrowser } from "./open.js";
import { listenOnFreePort, serve } from "./serve.js";

const SEARCH_PATH = "/__mdxr_library/search";
const OPEN_PREFIX = "/__mdxr_library/open/";
const DELETE_BASE = "/__mdxr_library/document";
const DELETE_PREFIX = `${DELETE_BASE}/`;
const DELETE_ACTION_HEADER = "x-mdxr-library-action";

interface PreviewEntry {
  generation: number;
  pending: Promise<http.Server>;
}

const serverUrl = (server: http.Server): string => {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Document library server is not listening");
  }
  return `http://localhost:${address.port}`;
};

const stopPreview = (server: http.Server): void => {
  server.closeAllConnections();
  server.close();
};

/** Reuse each document's existing live workspace until the library closes. */
const createPreviews = () => {
  const previews = new Map<string, PreviewEntry>();
  const generations = new Map<string, number>();
  let closed = false;

  const closePreview = (pending: Promise<http.Server>): void => {
    void (async () => {
      try {
        stopPreview(await pending);
      } catch {
        // Failed preview starts have no listening server to close.
      }
    })();
  };

  return {
    close(): void {
      closed = true;
      for (const { pending } of previews.values()) {
        closePreview(pending);
      }
      previews.clear();
    },
    async open(file: string): Promise<string> {
      if (closed) {
        throw new Error("Document library has closed");
      }
      let entry = previews.get(file);
      if (entry === undefined) {
        entry = {
          generation: generations.get(file) ?? 0,
          pending: serve(file, 0),
        };
        previews.set(file, entry);
      }
      try {
        const preview = await entry.pending;
        if (
          closed ||
          (generations.get(file) ?? 0) !== entry.generation ||
          previews.get(file) !== entry
        ) {
          stopPreview(preview);
          throw new Error("Document preview has been invalidated");
        }
        return serverUrl(preview);
      } catch (error) {
        if (previews.get(file) === entry) {
          previews.delete(file);
        }
        throw error;
      }
    },
    async remove(file: string): Promise<void> {
      const entry = previews.get(file);
      previews.delete(file);
      generations.set(file, (generations.get(file) ?? 0) + 1);
      if (entry !== undefined) {
        try {
          stopPreview(await entry.pending);
        } catch {
          // Failed preview starts have no listening server to close.
        }
      }
    },
  };
};

const localRequest = (request: http.IncomingMessage): boolean => {
  const port = request.socket.localPort;
  const { host } = request.headers;
  return (
    (host === `localhost:${port}` || host === `127.0.0.1:${port}`) &&
    (request.headers.origin === undefined ||
      request.headers.origin === `http://${host}`)
  );
};

const reply = (
  response: http.ServerResponse,
  status: number,
  body: string,
  type = "application/json; charset=utf-8"
): void => {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": type,
    "x-content-type-options": "nosniff",
  });
  response.end(body);
};

const parseSort = (value: string | null): LibrarySort | undefined => {
  if (value === null) {
    return "relevance";
  }
  return value === "relevance" || value === "updated" || value === "title"
    ? value
    : undefined;
};

type LibraryIndex = Awaited<ReturnType<typeof createLibraryIndex>>;
type Previews = ReturnType<typeof createPreviews>;

const isDeleteDocumentPath = (pathname: string): boolean =>
  pathname === DELETE_BASE || pathname.startsWith(DELETE_PREFIX);

const openDocument = async (
  pathname: string,
  response: http.ServerResponse,
  index: LibraryIndex,
  previews: Previews
): Promise<void> => {
  let id: string;
  try {
    id = decodeURIComponent(pathname.slice(OPEN_PREFIX.length));
  } catch {
    reply(response, 400, JSON.stringify({ error: "invalid-document" }));
    return;
  }
  const file = await index.resolve(id);
  if (file === undefined) {
    reply(
      response,
      404,
      "文書が見つかりません。一覧を更新してください。\nDocument not found. Refresh the library.",
      "text/plain; charset=utf-8"
    );
    return;
  }
  const url = await previews.open(file);
  response.writeHead(303, { "cache-control": "no-store", location: url });
  response.end();
};

const deleteDocument = async (
  pathname: string,
  response: http.ServerResponse,
  index: LibraryIndex,
  previews: Previews
): Promise<void> => {
  const encodedId = pathname.startsWith(DELETE_PREFIX)
    ? pathname.slice(DELETE_PREFIX.length)
    : "";
  if (encodedId === "" || encodedId.includes("/")) {
    reply(response, 400, JSON.stringify({ error: "invalid-document" }));
    return;
  }
  let id: string;
  try {
    id = decodeURIComponent(encodedId);
  } catch {
    reply(response, 400, JSON.stringify({ error: "invalid-document" }));
    return;
  }
  const result = await index.remove(id);
  if (result.status === "invalid") {
    reply(response, 400, JSON.stringify({ error: "invalid-document" }));
    return;
  }
  if (result.status === "not-found") {
    reply(response, 404, JSON.stringify({ error: "not-found" }));
    return;
  }
  await previews.remove(result.filePath);
  response.writeHead(204, {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end();
};

const handleDeleteRequest = async (
  request: http.IncomingMessage,
  pathname: string,
  response: http.ServerResponse,
  index: LibraryIndex,
  previews: Previews
): Promise<void> => {
  if (request.method !== "DELETE") {
    response.setHeader("allow", "DELETE");
    reply(response, 405, JSON.stringify({ error: "method-not-allowed" }));
    return;
  }
  if (
    request.headers[DELETE_ACTION_HEADER] !== "delete" ||
    request.headers["sec-fetch-site"] === "cross-site"
  ) {
    reply(response, 403, JSON.stringify({ error: "forbidden" }));
    return;
  }
  await deleteDocument(pathname, response, index, previews);
};

const handleLibraryRequest = async (
  request: http.IncomingMessage,
  response: http.ServerResponse,
  index: LibraryIndex,
  previews: Previews,
  html: string
): Promise<void> => {
  if (!localRequest(request)) {
    reply(response, 403, JSON.stringify({ error: "forbidden" }));
    return;
  }
  const url = new URL(request.url ?? "/", "http://localhost");
  const deletePath = isDeleteDocumentPath(url.pathname);
  if (deletePath) {
    await handleDeleteRequest(request, url.pathname, response, index, previews);
    return;
  }
  if (request.method !== "GET") {
    response.setHeader("allow", "GET");
    reply(response, 405, JSON.stringify({ error: "method-not-allowed" }));
    return;
  }
  if (url.pathname === "/") {
    reply(response, 200, html, "text/html; charset=utf-8");
    return;
  }
  if (url.pathname === "/__mdxr_library.js") {
    reply(response, 200, await libraryJs(), "text/javascript; charset=utf-8");
    return;
  }
  if (request.headers["sec-fetch-site"] === "cross-site") {
    reply(response, 403, JSON.stringify({ error: "forbidden" }));
    return;
  }
  if (url.pathname === SEARCH_PATH) {
    const sort = parseSort(url.searchParams.get("sort"));
    if (sort === undefined) {
      reply(response, 400, JSON.stringify({ error: "invalid-sort" }));
      return;
    }
    const result = await index.search({
      query: url.searchParams.get("q") ?? "",
      sort,
      status: url.searchParams.get("status") ?? undefined,
    });
    reply(response, 200, JSON.stringify(result));
    return;
  }
  if (url.pathname.startsWith(OPEN_PREFIX)) {
    await openDocument(url.pathname, response, index, previews);
    return;
  }
  reply(response, 404, JSON.stringify({ error: "not-found" }));
};

/** Browse a local directory without evaluating its documents during indexing. */
export const serveLibrary = async (
  dir: string,
  port: number,
  opts: { open?: boolean } = {}
): Promise<http.Server> => {
  const [index, html] = await Promise.all([
    createLibraryIndex(dir),
    libraryHtml(),
  ]);
  const previews = createPreviews();
  const server = http.createServer((request, response) => {
    void (async () => {
      try {
        await handleLibraryRequest(request, response, index, previews, html);
      } catch (error) {
        console.error(`mdxr: library: ${formatError(error)}`);
        reply(response, 500, JSON.stringify({ error: "library-error" }));
      }
    })();
  });
  server.on("close", () => {
    previews.close();
  });
  try {
    await listenOnFreePort(server, port);
  } catch (error) {
    server.close();
    throw error;
  }
  const url = serverUrl(server);
  console.log(`mdxr: library ${dir} at ${url}`);
  if (opts.open === true) {
    await openInBrowser(url);
  }
  return server;
};

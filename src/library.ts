import http from "node:http";
import path from "node:path";

import { validateAgentOptions } from "./agent-options.js";
import { formatError } from "./format-error.js";
import { createLibraryIndex } from "./library-index.js";
import { libraryHtml, libraryJs } from "./library-page.js";
import type { LibrarySort } from "./library-types.js";
import { isLocalOrigin, replyJson, replyText } from "./local-http.js";
import { openInBrowser } from "./open.js";
import { listenOnFreePort, serve } from "./serve.js";
import type { ServeOptions } from "./serve.js";

export interface LibraryOptions extends Pick<
  ServeOptions,
  "agent" | "session" | "server"
> {
  /** Open the listing, or a document file path resolved from the working directory. */
  open?: boolean | string;
}

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
const createPreviews = (
  opts: Pick<LibraryOptions, "agent" | "session" | "server">
) => {
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
          pending: serve(file, 0, opts),
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

const initialPreviewPath = async (
  dir: string,
  file: string | undefined,
  index: LibraryIndex
): Promise<string> => {
  if (file === undefined) {
    return "/";
  }
  const id = path
    .relative(path.resolve(dir), path.resolve(file))
    .split(path.sep)
    .join("/");
  if ((await index.resolve(id)) === undefined) {
    throw new Error(`Cannot open document in this library: ${file}`);
  }
  return `${OPEN_PREFIX}${encodeURIComponent(id)}`;
};

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
    replyJson(response, 400, { error: "invalid-document" });
    return;
  }
  const file = await index.resolve(id);
  if (file === undefined) {
    replyText(
      response,
      404,
      "文書が見つかりません。一覧を更新してください。\nDocument not found. Refresh the library.",
      "text/plain; charset=utf-8"
    );
    return;
  }
  const url = await previews.open(file);
  const documentPath = id.split("/").map(encodeURIComponent).join("/");
  response.writeHead(303, {
    "cache-control": "no-store",
    location: `${url}/${documentPath}`,
  });
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
    replyJson(response, 400, { error: "invalid-document" });
    return;
  }
  let id: string;
  try {
    id = decodeURIComponent(encodedId);
  } catch {
    replyJson(response, 400, { error: "invalid-document" });
    return;
  }
  const result = await index.remove(id);
  if (result.status === "invalid") {
    replyJson(response, 400, { error: "invalid-document" });
    return;
  }
  if (result.status === "not-found") {
    replyJson(response, 404, { error: "not-found" });
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
    replyJson(response, 405, { error: "method-not-allowed" });
    return;
  }
  if (
    request.headers[DELETE_ACTION_HEADER] !== "delete" ||
    request.headers["sec-fetch-site"] === "cross-site"
  ) {
    replyJson(response, 403, { error: "forbidden" });
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
  if (!isLocalOrigin(request)) {
    replyJson(response, 403, { error: "forbidden" });
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
    replyJson(response, 405, { error: "method-not-allowed" });
    return;
  }
  if (url.pathname === "/") {
    replyText(response, 200, html, "text/html; charset=utf-8");
    return;
  }
  if (url.pathname === "/__mdxr_library.js") {
    replyText(
      response,
      200,
      await libraryJs(),
      "text/javascript; charset=utf-8"
    );
    return;
  }
  if (request.headers["sec-fetch-site"] === "cross-site") {
    replyJson(response, 403, { error: "forbidden" });
    return;
  }
  if (url.pathname === SEARCH_PATH) {
    const sort = parseSort(url.searchParams.get("sort"));
    if (sort === undefined) {
      replyJson(response, 400, { error: "invalid-sort" });
      return;
    }
    const result = await index.search({
      query: url.searchParams.get("q") ?? "",
      sort,
      status: url.searchParams.get("status") ?? undefined,
    });
    replyJson(response, 200, result);
    return;
  }
  if (url.pathname.startsWith(OPEN_PREFIX)) {
    await openDocument(url.pathname, response, index, previews);
    return;
  }
  replyJson(response, 404, { error: "not-found" });
};

/** Browse a local directory without evaluating its documents during indexing. */
export const serveLibrary = async (
  dir: string,
  port: number,
  opts: LibraryOptions = {}
): Promise<http.Server> => {
  validateAgentOptions(opts.agent, opts.session, opts.server);
  const [index, html] = await Promise.all([
    createLibraryIndex(dir),
    libraryHtml(),
  ]);
  const initialPath = await initialPreviewPath(
    dir,
    typeof opts.open === "string" ? opts.open : undefined,
    index
  );
  const previews = createPreviews({
    agent: opts.agent,
    server: opts.server,
    session: opts.session,
  });
  const server = http.createServer((request, response) => {
    void (async () => {
      try {
        await handleLibraryRequest(request, response, index, previews, html);
      } catch (error) {
        console.error(`mdxr: library: ${formatError(error)}`);
        replyJson(response, 500, { error: "library-error" });
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
  if (opts.open === true || typeof opts.open === "string") {
    await openInBrowser(`${url}${initialPath}`);
  }
  return server;
};

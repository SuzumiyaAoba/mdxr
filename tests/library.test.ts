import { once } from "node:events";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import http from "node:http";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { THEME_JS } from "../src/assets/scripts.js";
import { inlineScript } from "../src/html.js";
import { serveLibrary } from "../src/library.js";

const SEARCH_PATH = "/__mdxr_library/search";
const DELETE_PREFIX = "/__mdxr_library/document/";
const DELETE_HEADERS = { "X-MDXR-Library-Action": "delete" };
const roots: string[] = [];
const servers: Server[] = [];

const makeLibrary = async (): Promise<{ root: string; url: string }> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mdxr-library-http-"));
  roots.push(root);
  const server = await serveLibrary(root, 0);
  servers.push(server);
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Library did not start");
  }
  return { root, url: `http://127.0.0.1:${address.port}` };
};

describe("document library HTTP", () => {
  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(async (server) => {
        const closed = once(server, "close");
        server.closeAllConnections();
        server.close();
        await closed;
      })
    );
    await Promise.all(
      roots.splice(0).map(async (root) => {
        await rm(root, { force: true, recursive: true });
      })
    );
  });

  it("serves the library shell and searches Japanese documents without rendering MDX", async () => {
    const { root, url } = await makeLibrary();
    await mkdir(path.join(root, "日本語の計画"));
    await writeFile(
      path.join(root, "日本語の計画/index.mdx"),
      '---\ntitle: カタログ検索\nstatus: doing\n---\n\n## 設計\n日本語で検索します。\n\n<Unknown title="追加の属性" />'
    );
    const shell = await fetch(url);
    const shellHtml = await shell.text();
    const themeScriptIndex = shellHtml.indexOf(
      `<script>${inlineScript(THEME_JS)}</script>`
    );
    expect({
      hasCharset: shell.headers.get("content-type")?.includes("charset=utf-8"),
      hasLibraryRoot: shellHtml.includes('id="mdxr-library-root"'),
      themeScriptInHead:
        themeScriptIndex !== -1 &&
        themeScriptIndex < shellHtml.indexOf("</head>"),
    }).toStrictEqual({
      hasCharset: true,
      hasLibraryRoot: true,
      themeScriptInHead: true,
    });

    const params = new URLSearchParams({
      q: "かたろぐ　日本語",
      status: "doing",
    });
    const response = await fetch(`${url}${SEARCH_PATH}?${params}`);
    const body: unknown = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      matched: 1,
      results: [
        {
          path: "日本語の計画/index.mdx",
          title: "カタログ検索",
        },
      ],
    });
  });

  it("opens Japanese filenames in a reused live workspace", async () => {
    const { root, url } = await makeLibrary();
    const name = "設計 と 検証.mdx";
    await writeFile(
      path.join(root, name),
      "# 日本語のプレビュー\n\n本文です。"
    );
    const openUrl = `${url}/__mdxr_library/open/${encodeURIComponent(name)}`;
    const opened = await fetch(openUrl, { redirect: "manual" });
    expect(opened.status).toBe(303);
    const location = opened.headers.get("location");
    expect(location).toMatch(/^http:\/\/localhost:\d+$/u);
    const repeated = await fetch(openUrl, { redirect: "manual" });
    expect(repeated.headers.get("location")).toBe(location);

    const preview = await fetch(location ?? "");
    const html = await preview.text();
    expect(html).toMatch(/日本語のプレビュー[\s\S]*mdxr-workspace-root/u);
    await rm(path.join(root, name));
    const missing = await fetch(openUrl, { redirect: "manual" });
    expect(missing.status).toBe(404);
  });

  it("closes and invalidates an open preview when its document is deleted", async () => {
    const { root, url } = await makeLibrary();
    const name = "preview.mdx";
    await writeFile(path.join(root, name), "# Preview\n");
    const openUrl = `${url}/__mdxr_library/open/${encodeURIComponent(name)}`;
    const opened = await fetch(openUrl, { redirect: "manual" });
    const location = opened.headers.get("location");
    if (location === null) {
      throw new Error("Preview did not return a location");
    }

    const deleted = await fetch(
      `${url}${DELETE_PREFIX}${encodeURIComponent(name)}`,
      { headers: DELETE_HEADERS, method: "DELETE" }
    );
    const missing = await fetch(openUrl, { redirect: "manual" });

    expect(opened.status).toBe(303);
    expect(deleted.status).toBe(204);
    expect(missing.status).toBe(404);
    await expect(fetch(location)).rejects.toThrow(
      /fetch failed|ECONNREFUSED/iu
    );
  });

  it("deletes one encoded document and refreshes the searchable index", async () => {
    const { root, url } = await makeLibrary();
    const directory = path.join(root, "資料");
    const removedPath = path.join(directory, "削除する 文書.mdx");
    const keptPath = path.join(directory, "残す文書.md");
    const assetPath = path.join(directory, "図.svg");
    await mkdir(directory);
    await writeFile(removedPath, "# 削除する文書\n");
    await writeFile(keptPath, "# 残す文書\n");
    await writeFile(assetPath, "<svg />\n");

    const response = await fetch(
      `${url}${DELETE_PREFIX}${encodeURIComponent("資料/削除する 文書.mdx")}`,
      { headers: DELETE_HEADERS, method: "DELETE" }
    );
    const searchResponse = await fetch(`${url}${SEARCH_PATH}`);
    const searchBody: unknown = await searchResponse.json();

    expect({
      asset: await readFile(assetPath, "utf-8"),
      deletedStatus: response.status,
      parentStillExists: await stat(directory).then((stats) =>
        stats.isDirectory()
      ),
      remaining: searchBody,
      removedExists: await stat(removedPath)
        .then(() => true)
        .catch(() => false),
      sibling: await readFile(keptPath, "utf-8"),
    }).toMatchObject({
      asset: "<svg />\n",
      deletedStatus: 204,
      parentStillExists: true,
      remaining: {
        matched: 1,
        results: [{ id: "資料/残す文書.md" }],
        total: 1,
      },
      removedExists: false,
      sibling: "# 残す文書\n",
    });
  });

  it("requires the delete action header and rejects unsafe or missing IDs", async () => {
    const { root, url } = await makeLibrary();
    const documentPath = path.join(root, "kept.mdx");
    await writeFile(documentPath, "# Keep\n");
    const documentUrl = `${url}${DELETE_PREFIX}kept.mdx`;
    const responses = await Promise.all([
      fetch(documentUrl, { method: "DELETE" }),
      fetch(documentUrl, {
        headers: DELETE_HEADERS,
        method: "GET",
      }),
      fetch(documentUrl, {
        headers: {
          ...DELETE_HEADERS,
          "sec-fetch-site": "cross-site",
        },
        method: "DELETE",
      }),
      fetch(documentUrl, {
        headers: {
          ...DELETE_HEADERS,
          origin: "https://example.com",
        },
        method: "DELETE",
      }),
      fetch(`${url}${DELETE_PREFIX}%ZZ`, {
        headers: DELETE_HEADERS,
        method: "DELETE",
      }),
      fetch(`${url}${DELETE_PREFIX}${encodeURIComponent("../outside.mdx")}`, {
        headers: DELETE_HEADERS,
        method: "DELETE",
      }),
      fetch(`${url}${DELETE_PREFIX}missing.mdx`, {
        headers: DELETE_HEADERS,
        method: "DELETE",
      }),
    ]);
    const statuses = responses.map((response) => response.status);
    const getAllow = responses[1]?.headers.get("allow");
    await Promise.all(
      responses.map(async (response) => await response.arrayBuffer())
    );

    expect({
      documentStillExists: await stat(documentPath).then((stats) =>
        stats.isFile()
      ),
      getAllow,
      statuses,
    }).toStrictEqual({
      documentStillExists: true,
      getAllow: "DELETE",
      statuses: [403, 405, 403, 403, 400, 400, 404],
    });
  });

  it("rejects unlisted paths, symlinks, and invalid requests", async () => {
    const { root, url } = await makeLibrary();
    await writeFile(path.join(root, "valid.mdx"), "# Valid");
    await symlink(path.join(root, "valid.mdx"), path.join(root, "link.mdx"));
    const responses = await Promise.all([
      fetch(
        `${url}/__mdxr_library/open/${encodeURIComponent("../secret.mdx")}`
      ),
      fetch(`${url}/__mdxr_library/open/link.mdx`),
      fetch(`${url}/__mdxr_library/open/%ZZ`),
      fetch(`${url}${SEARCH_PATH}?sort=unexpected`),
      fetch(`${url}${SEARCH_PATH}`, { method: "POST" }),
      fetch(`${url}${SEARCH_PATH}`, {
        headers: { origin: "https://example.com" },
      }),
      fetch(`${url}${SEARCH_PATH}`, {
        headers: { "sec-fetch-site": "cross-site" },
      }),
      fetch(`${url}/not-a-document`),
    ]);
    expect(responses.map((response) => response.status)).toStrictEqual([
      404, 404, 400, 400, 405, 403, 403, 404,
    ]);
    await Promise.all(
      responses.map(async (response) => await response.arrayBuffer())
    );

    let hostileStatus = 0;
    const request = http.get(
      url,
      { headers: { host: "example.com" } },
      (response) => {
        hostileStatus = response.statusCode ?? 0;
        response.resume();
      }
    );
    await once(request, "close");
    expect(hostileStatus).toBe(403);
  });
});

import { randomUUID } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
import { open, realpath } from "node:fs/promises";
import type http from "node:http";
import path from "node:path";

import type { ConfigOptions } from "./config.js";
import type { FilePreviewData } from "./file-preview-data.js";
import { formatError } from "./format-error.js";
import { isRecord } from "./guards.js";
import { langForPath } from "./langs.js";
import { isLocalOrigin, replyJson } from "./local-http.js";
import { IMAGE_MIME_TYPES } from "./rehype/linked-assets.js";
import { highlightSource } from "./rehype/shiki.js";
import { render } from "./render.js";

const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown", ".mdx", ".mdown"]);

class FilePreviewError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "FilePreviewError";
    this.status = status;
  }
}

interface PreviewFile {
  path: string;
  canonical: string;
  id: string;
}

const readPreviewFile = async (
  file: PreviewFile,
  limit: number
): Promise<Buffer> => {
  // A symlink replaced after the document was rendered must not grant access
  // to an unreferenced file. Never accept filesystem paths from HTTP input.
  if ((await realpath(file.path)) !== file.canonical) {
    throw new FilePreviewError(403, "The referenced file has changed location");
  }
  const handle = await open(file.canonical, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) {
      throw new FilePreviewError(415, "Only regular files can be previewed");
    }
    if (stat.size > limit) {
      throw new FilePreviewError(
        413,
        "This file is too large to preview. Open it in your editor."
      );
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
};

const decodeText = (contents: Buffer): string => {
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(contents);
    if (source.includes("\0")) {
      throw new Error("Binary content");
    }
    return source;
  } catch {
    throw new FilePreviewError(
      415,
      "This file is not UTF-8 text. Open it in your editor."
    );
  }
};

const previewData = async (
  file: PreviewFile,
  theme: "light" | "dark",
  configOptions: ConfigOptions
): Promise<FilePreviewData> => {
  const extension = path.extname(file.path).toLowerCase();
  const mime = IMAGE_MIME_TYPES[extension];
  const contents = await readPreviewFile(
    file,
    mime === undefined ? MAX_TEXT_BYTES : MAX_IMAGE_BYTES
  );
  if (mime !== undefined) {
    return {
      kind: "image",
      src: `data:${mime};base64,${contents.toString("base64")}`,
    };
  }
  const source = decodeText(contents);
  const markdown = MARKDOWN_EXTENSIONS.has(extension);
  const lang = extension === ".mdx" ? "mdx" : langForPath(file.path);
  const syntax = await highlightSource(
    source,
    lang ?? (markdown ? "markdown" : "text")
  );
  if (!markdown) {
    return { kind: "text", source, syntax };
  }
  try {
    const html = await render(source, {
      ...configOptions,
      dir: path.dirname(file.path),
      documentControls: false,
      filePath: file.path,
      initialTheme: theme,
      inlineAssets: true,
    });
    return { html, kind: "markdown", source, syntax };
  } catch (error) {
    // Raw remains available even when MDX cannot compile this document.
    return {
      kind: "markdown",
      renderError: formatError(error),
      source,
      syntax,
    };
  }
};

const replyError = (response: http.ServerResponse, error: unknown): void => {
  if (
    isRecord(error) &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  ) {
    replyJson(response, 404, { error: "The referenced file no longer exists" });
    return;
  }
  const status = error instanceof FilePreviewError ? error.status : 500;
  replyJson(response, status, { error: formatError(error) });
};

/** Per-server capabilities, issued only for files a rendered FileRef uses. */
export const createFilePreviews = (configOptions: ConfigOptions = {}) => {
  const paths = new Map<string, PreviewFile>();
  const files = new Map<string, PreviewFile>();
  return {
    async handle(
      request: http.IncomingMessage,
      response: http.ServerResponse
    ): Promise<void> {
      if (
        !isLocalOrigin(request) ||
        request.headers["sec-fetch-site"] === "cross-site"
      ) {
        replyJson(response, 403, { error: "Request origin is not allowed" });
        return;
      }
      if (request.method !== "GET") {
        replyJson(
          response,
          405,
          { error: "Method not allowed" },
          { allow: "GET" }
        );
        return;
      }
      const params = new URL(request.url ?? "", "http://localhost")
        .searchParams;
      const file = files.get(params.get("id") ?? "");
      if (file === undefined) {
        replyJson(response, 404, {
          error: "The referenced file is unavailable",
        });
        return;
      }
      try {
        replyJson(
          response,
          200,
          await previewData(
            file,
            params.get("theme") === "dark" ? "dark" : "light",
            configOptions
          )
        );
      } catch (error) {
        replyError(response, error);
      }
    },
    register: (filePath: string): string | undefined => {
      try {
        const canonical = realpathSync(filePath);
        if (!statSync(canonical).isFile()) {
          return undefined;
        }
        let file = paths.get(filePath);
        if (file === undefined || file.canonical !== canonical) {
          file = { canonical, id: randomUUID(), path: filePath };
          paths.set(filePath, file);
          files.set(file.id, file);
        }
        return `/__doc_file?id=${file.id}`;
      } catch {
        return undefined;
      }
    },
  };
};

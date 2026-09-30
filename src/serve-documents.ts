import { mkdir, stat } from "node:fs/promises";
import type { Server } from "node:http";
import path from "node:path";

import { serveLibrary } from "./library.js";
import type { LibraryOptions } from "./library.js";

/** Keep a document inside .mdxr in the same library as its sibling documents. */
const documentRoot = (file: string): string => {
  let directory = path.dirname(file);
  while (true) {
    if (path.basename(directory) === ".mdxr") {
      return directory;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return path.dirname(file);
    }
    directory = parent;
  }
};

/** Serve the document directory; a file argument selects its initial preview. */
export const serveDocuments = async (
  input: string | undefined,
  port: number,
  opts: LibraryOptions = {}
): Promise<Server> => {
  const target = path.resolve(input ?? ".mdxr");
  if (input === undefined) {
    await mkdir(target, { recursive: true });
  }
  const stats = await stat(target);
  if (stats.isDirectory()) {
    return await serveLibrary(target, port, opts);
  }
  if (!stats.isFile()) {
    throw new Error(`Serve path is not a file or directory: ${target}`);
  }
  return await serveLibrary(documentRoot(target), port, {
    ...opts,
    open: opts.open === true ? target : opts.open,
  });
};

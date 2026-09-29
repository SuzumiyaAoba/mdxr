import type fs from "node:fs";
import { constants } from "node:fs";
import { lstat, open, readdir, realpath, stat, unlink } from "node:fs/promises";
import path from "node:path";

import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Node } from "unist";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { matter } from "vfile-matter";

import { isRecord } from "./guards.js";
import { searchLibraryDocuments } from "./library-search.js";
import type { SearchableLibraryDocument } from "./library-search.js";
import type {
  LibrarySearchOptions,
  LibrarySearchResponse,
  LibraryWarning,
} from "./library-types.js";

type BigIntStats = fs.BigIntStats;
type Dirent = fs.Dirent;

interface IndexedDocument {
  document: SearchableLibraryDocument;
  signature: string;
  warning?: LibraryWarning;
}

interface ParsedDocument {
  body: string;
  parseWarning: boolean;
  status: string;
  title: string;
}

const excludedDirectories = new Set([
  ".git",
  ".mdxr-cache",
  "dist",
  "node_modules",
  "storybook-static",
]);
const markdownExtensions = new Set([".md", ".markdown", ".mdx"]);
const ignoredNodeTypes = new Set([
  "definition",
  "mdxFlowExpression",
  "mdxjsEsm",
  "mdxTextExpression",
  "toml",
  "yaml",
]);
const searchableMdxAttributes = new Set([
  "alt",
  "aria-label",
  "caption",
  "description",
  "heading",
  "label",
  "name",
  "placeholder",
  "summary",
  "text",
  "title",
  "tooltip",
  "value",
]);
const blockNodeTypes = new Set([
  "blockquote",
  "code",
  "heading",
  "listItem",
  "paragraph",
  "tableCell",
  "tableRow",
  "thematicBreak",
]);
const mdxParser = unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(remarkFrontmatter)
  .use(remarkGfm);
const markdownParser = unified()
  .use(remarkParse)
  .use(remarkFrontmatter)
  .use(remarkGfm);

const scalarText = (value: unknown): string => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString();
  }
  return "";
};

const rawNode = (
  node: Node
): Node & {
  alt?: unknown;
  attributes?: unknown[];
  children?: Node[];
  name?: unknown;
  value?: unknown;
} => node;

const appendLeafNodeText = (
  node: Node,
  current: ReturnType<typeof rawNode>,
  chunks: string[]
): boolean => {
  if (
    node.type === "text" ||
    node.type === "inlineCode" ||
    node.type === "code"
  ) {
    if (typeof current.value === "string") {
      chunks.push(current.value);
    }
    return true;
  }
  if (node.type === "image" || node.type === "imageReference") {
    if (typeof current.alt === "string") {
      chunks.push(current.alt);
    }
    return true;
  }
  if (node.type === "break" || node.type === "thematicBreak") {
    chunks.push("\n");
    return true;
  }
  if (node.type === "html" && typeof current.value === "string") {
    chunks.push(
      current.value
        .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/giu, " ")
        .replaceAll(/<style\b[^>]*>[\s\S]*?<\/style\s*>/giu, " ")
        .replaceAll(/<!--[\s\S]*?-->/gu, " ")
        .replaceAll(/<[^>]*>/gu, " ")
    );
    return true;
  }
  return false;
};

const appendMdxAttributes = (
  current: ReturnType<typeof rawNode>,
  chunks: string[]
): void => {
  for (const rawAttribute of current.attributes ?? []) {
    if (!isRecord(rawAttribute)) {
      continue;
    }
    const { name, value } = rawAttribute;
    if (
      typeof name === "string" &&
      searchableMdxAttributes.has(name.toLowerCase()) &&
      typeof value === "string"
    ) {
      chunks.push(value);
    }
  }
};

const appendNodeText = (node: Node, chunks: string[]): void => {
  if (ignoredNodeTypes.has(node.type)) {
    return;
  }

  const current = rawNode(node);
  if (appendLeafNodeText(node, current, chunks)) {
    return;
  }
  if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
    appendMdxAttributes(current, chunks);
  }

  const isBlock = blockNodeTypes.has(node.type);
  if (isBlock) {
    chunks.push("\n");
  }
  for (const child of current.children ?? []) {
    appendNodeText(child, chunks);
  }
  if (isBlock) {
    chunks.push("\n");
  }
};

const plainText = (node: Node): string => {
  const chunks: string[] = [];
  appendNodeText(node, chunks);
  return chunks
    .join("")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll(/[ \t]+\n/gu, "\n")
    .replaceAll(/\n{3,}/gu, "\n\n")
    .trim();
};

const firstHeading = (tree: Node): string => {
  let heading = "";
  visit(tree, "heading", (node: Node) => {
    if (heading === "") {
      heading = plainText(node);
    }
  });
  return heading;
};

const withoutFrontmatter = (source: string): string => {
  const lines = source.replace(/^\uFEFF/u, "").split(/\r?\n/u);
  if (lines[0]?.trim() !== "---") {
    return source;
  }
  const closing = lines.findIndex(
    (line, index) =>
      index > 0 && (line.trim() === "---" || line.trim() === "...")
  );
  return closing === -1 ? source : lines.slice(closing + 1).join("\n");
};

const parseDocument = (
  source: string,
  relativePath: string
): ParsedDocument => {
  let metadata: Record<string, unknown> = {};
  let parseWarning = false;
  try {
    const file = new VFile({ value: source });
    matter(file);
    metadata = isRecord(file.data.matter) ? file.data.matter : {};
  } catch {
    parseWarning = true;
  }

  let tree: Node;
  try {
    const parser =
      path.extname(relativePath).toLowerCase() === ".mdx"
        ? mdxParser
        : markdownParser;
    tree = parser.parse(source);
  } catch {
    parseWarning = true;
    tree = markdownParser.parse(withoutFrontmatter(source));
  }

  const titleFromMetadata = scalarText(metadata.title);
  const title =
    titleFromMetadata ||
    firstHeading(tree) ||
    path.basename(relativePath, path.extname(relativePath));

  return {
    body: plainText(tree),
    parseWarning,
    status: scalarText(metadata.status),
    title,
  };
};

const isWithinRoot = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
};

const filePathForId = (root: string, id: string): string | undefined => {
  if (
    id === "" ||
    id.includes("\\") ||
    id.includes("\0") ||
    path.posix.isAbsolute(id) ||
    path.win32.parse(id).root !== ""
  ) {
    return undefined;
  }
  const parts = id.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    return undefined;
  }
  const filePath = path.resolve(root, ...parts);
  return isWithinRoot(root, filePath) && filePath !== root
    ? filePath
    : undefined;
};

const isMissingPathError = (error: unknown): boolean =>
  isRecord(error) && error.code === "ENOENT";

const signatureOf = (stats: BigIntStats): string =>
  [stats.dev, stats.ino, stats.mode, stats.size, stats.mtimeNs, stats.ctimeNs]
    .map(String)
    .join(":");

const warningFor = (
  relativePath: string,
  reason: LibraryWarning["reason"]
): LibraryWarning => ({
  path: relativePath || ".",
  reason,
});

class UnsafeLibraryPathError extends Error {
  constructor() {
    super("Path is not a regular file inside the library root");
    this.name = "UnsafeLibraryPathError";
  }
}

const unsafePathError = (): UnsafeLibraryPathError =>
  new UnsafeLibraryPathError();

const checkedFileStat = async (
  root: string,
  filePath: string
): Promise<BigIntStats> => {
  if (!isWithinRoot(root, filePath) || filePath === root) {
    throw unsafePathError();
  }

  const relative = path.relative(root, filePath);
  const parts = relative.split(path.sep).filter(Boolean);
  let current = root;
  let currentStats: BigIntStats | undefined;
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    // Each lstat validates the next component before descending to it.
    // oxlint-disable-next-line no-await-in-loop
    currentStats = await lstat(current, { bigint: true });
    const final = index === parts.length - 1;
    if (
      currentStats.isSymbolicLink() ||
      (final ? !currentStats.isFile() : !currentStats.isDirectory())
    ) {
      throw unsafePathError();
    }
  }

  const actualPath = await realpath(filePath);
  if (!isWithinRoot(root, actualPath)) {
    throw unsafePathError();
  }
  if (currentStats === undefined) {
    throw unsafePathError();
  }
  return currentStats;
};

const readStableFile = async (
  root: string,
  filePath: string
): Promise<{ signature: string; source: string; stats: BigIntStats }> => {
  // fs.open flags are bit masks, so this intentionally combines both values.
  // oxlint-disable-next-line no-bitwise
  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);
  const readAttempt = async (
    attempt: number
  ): Promise<{ signature: string; source: string; stats: BigIntStats }> => {
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    let stableRead:
      | { signature: string; source: string; stats: BigIntStats }
      | undefined;
    try {
      await checkedFileStat(root, filePath);
      handle = await open(filePath, flags);
      const opened = await handle.stat({ bigint: true });
      if (!opened.isFile()) {
        throw unsafePathError();
      }
      const source = await handle.readFile({ encoding: "utf-8" });
      const afterRead = await handle.stat({ bigint: true });
      await handle.close();
      handle = undefined;
      const current = await checkedFileStat(root, filePath);
      if (
        signatureOf(opened) === signatureOf(afterRead) &&
        signatureOf(afterRead) === signatureOf(current)
      ) {
        stableRead = {
          signature: signatureOf(current),
          source,
          stats: current,
        };
      }
    } finally {
      await handle?.close();
    }

    if (stableRead !== undefined) {
      return stableRead;
    }
    if (attempt >= 2) {
      throw new Error("File changed while it was being indexed");
    }
    return await readAttempt(attempt + 1);
  };

  const result = await readAttempt(0);
  return result;
};

const compareWarnings = (
  left: LibraryWarning,
  right: LibraryWarning
): number => {
  if (left.path < right.path) {
    return -1;
  }
  if (left.path > right.path) {
    return 1;
  }
  if (left.reason < right.reason) {
    return -1;
  }
  if (left.reason > right.reason) {
    return 1;
  }
  return 0;
};

const statusList = (documents: readonly IndexedDocument[]): string[] =>
  [
    ...new Set(
      documents.map(({ document }) => document.status).filter(Boolean)
    ),
  ].toSorted();

const assertRootDirectory = async (root: string): Promise<string> => {
  const requestedRoot = path.resolve(root);
  let rootStats: BigIntStats;
  try {
    rootStats = await stat(requestedRoot, { bigint: true });
  } catch {
    throw new Error(`Document library root does not exist: ${requestedRoot}`);
  }
  if (!rootStats.isDirectory()) {
    throw new Error(
      `Document library root is not a directory: ${requestedRoot}`
    );
  }
  return await realpath(requestedRoot);
};

/** Index local Markdown documents without compiling or executing MDX. */
export const createLibraryIndex = async (
  root: string
): Promise<{
  remove: (
    id: string
  ) => Promise<
    | { filePath: string; status: "deleted" }
    | { status: "invalid" }
    | { status: "not-found" }
  >;
  resolve: (id: string) => Promise<string | undefined>;
  search: (options?: LibrarySearchOptions) => Promise<LibrarySearchResponse>;
}> => {
  const absoluteRoot = await assertRootDirectory(root);
  let indexed = new Map<string, IndexedDocument>();
  let hasScanned = false;
  let refreshInFlight:
    | Promise<{ documents: IndexedDocument[]; warnings: LibraryWarning[] }>
    | undefined;
  let operationQueue: Promise<void> = Promise.resolve();

  const withOperationLock = async <Result>(
    operation: () => Promise<Result>
  ): Promise<Result> => {
    const previous = operationQueue;
    let releaseNext: (() => void) | undefined;
    // oxlint-disable-next-line promise/avoid-new -- This deferred gate serializes scan and delete operations.
    const next = new Promise<void>((resolve) => {
      releaseNext = () => {
        resolve();
      };
    });
    operationQueue = next;
    await previous;
    try {
      return await operation();
    } finally {
      releaseNext?.();
    }
  };

  const scan = async (): Promise<{
    documents: IndexedDocument[];
    warnings: LibraryWarning[];
  }> => {
    const next = new Map<string, IndexedDocument>();
    const warnings = new Map<string, LibraryWarning>();
    const addWarning = (
      relativePath: string,
      reason: LibraryWarning["reason"]
    ) => {
      const warning = warningFor(relativePath, reason);
      warnings.set(`${warning.path}\0${warning.reason}`, warning);
    };

    const indexFile = async (
      filePath: string,
      relativePath: string
    ): Promise<void> => {
      try {
        const current = await checkedFileStat(absoluteRoot, filePath);
        const signature = signatureOf(current);
        const id = relativePath.split(path.sep).join("/");
        const old = indexed.get(id);
        if (old?.signature === signature) {
          next.set(id, old);
          if (old.warning !== undefined) {
            warnings.set(
              `${old.warning.path}\0${old.warning.reason}`,
              old.warning
            );
          }
          return;
        }

        const read = await readStableFile(absoluteRoot, filePath);
        const parsed = parseDocument(read.source, id);
        const warning = parsed.parseWarning
          ? warningFor(id, "parse")
          : undefined;
        const document: SearchableLibraryDocument = {
          body: parsed.body,
          id,
          path: id,
          status: parsed.status,
          title: parsed.title,
          updatedAt: read.stats.mtime.toISOString(),
        };
        const entry: IndexedDocument = {
          document,
          signature: read.signature,
          ...(warning === undefined ? {} : { warning }),
        };
        next.set(id, entry);
        if (warning !== undefined) {
          warnings.set(`${warning.path}\0${warning.reason}`, warning);
        }
      } catch {
        addWarning(relativePath, "read");
      }
    };

    const walk = async (
      directory: string,
      relativeDirectory: string
    ): Promise<void> => {
      let entries: Dirent[];
      try {
        const directoryStats = await lstat(directory, { bigint: true });
        if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) {
          return;
        }
        const resolvedDirectory = await realpath(directory);
        if (!isWithinRoot(absoluteRoot, resolvedDirectory)) {
          return;
        }
        entries = await readdir(directory, { withFileTypes: true });
      } catch {
        addWarning(relativeDirectory, "read");
        return;
      }

      await Promise.all(
        entries.map(async (entry) => {
          const relativePath = path.join(relativeDirectory, entry.name);
          const child = path.join(directory, entry.name);
          if (entry.isSymbolicLink()) {
            return;
          }
          if (entry.isDirectory()) {
            const excluded = excludedDirectories.has(entry.name);
            const history =
              entry.name === "history" && path.basename(directory) === ".mdxr";
            if (!excluded && !history) {
              await walk(child, relativePath);
            }
            return;
          }
          if (
            entry.isFile() &&
            markdownExtensions.has(path.extname(entry.name).toLowerCase())
          ) {
            await indexFile(child, relativePath);
          }
        })
      );
    };

    await walk(absoluteRoot, "");
    indexed = next;
    hasScanned = true;
    return {
      documents: [...indexed.values()],
      warnings: [...warnings.values()].toSorted(compareWarnings),
    };
  };

  const refresh = async (): Promise<{
    documents: IndexedDocument[];
    warnings: LibraryWarning[];
  }> => {
    if (refreshInFlight !== undefined) {
      return await refreshInFlight;
    }
    const pending = withOperationLock(scan);
    refreshInFlight = pending;
    try {
      return await pending;
    } finally {
      if (refreshInFlight === pending) {
        refreshInFlight = undefined;
      }
    }
  };

  return {
    remove: async (id: string) =>
      await withOperationLock(async () => {
        if (!hasScanned) {
          await scan();
        }
        const filePath = filePathForId(absoluteRoot, id);
        if (filePath === undefined) {
          return { status: "invalid" } as const;
        }

        try {
          await checkedFileStat(absoluteRoot, filePath);
        } catch (error) {
          if (error instanceof UnsafeLibraryPathError) {
            return { status: "invalid" } as const;
          }
          if (isMissingPathError(error)) {
            indexed.delete(id);
            return { status: "not-found" } as const;
          }
          throw error;
        }

        if (!indexed.has(id)) {
          return { status: "not-found" } as const;
        }
        try {
          await unlink(filePath);
        } catch (error) {
          if (error instanceof UnsafeLibraryPathError) {
            return { status: "invalid" } as const;
          }
          if (isMissingPathError(error)) {
            indexed.delete(id);
            return { status: "not-found" } as const;
          }
          throw error;
        }
        indexed.delete(id);
        return { filePath, status: "deleted" } as const;
      }),
    resolve: async (id: string): Promise<string | undefined> =>
      await withOperationLock(async () => {
        if (!hasScanned) {
          await scan();
        }
        const filePath = indexed.has(id)
          ? filePathForId(absoluteRoot, id)
          : undefined;
        let isSafePath = false;
        if (filePath !== undefined) {
          try {
            await checkedFileStat(absoluteRoot, filePath);
            isSafePath = true;
          } catch {
            isSafePath = false;
          }
        }
        return isSafePath ? filePath : undefined;
      }),
    search: async (
      options: LibrarySearchOptions = {}
    ): Promise<LibrarySearchResponse> => {
      const refreshed = await refresh();
      const documents = refreshed.documents.map(({ document }) => document);
      const results = searchLibraryDocuments(documents, options);
      return {
        matched: results.length,
        results,
        root: absoluteRoot,
        statuses: statusList(refreshed.documents),
        total: documents.length,
        warnings: refreshed.warnings,
      };
    },
  };
};

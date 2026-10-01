import type { Dirent } from "node:fs";
import { lstat, readdir, realpath, unlink } from "node:fs/promises";
import path from "node:path";

import { checkSource } from "./check-source.js";
import { findConfig } from "./config.js";
import { parseLibraryDocument } from "./library-document.js";
import {
  assertRootDirectory,
  checkedFileStat,
  filePathForId,
  isMissingPathError,
  isWithinRoot,
  readStableFile,
  signatureOf,
  UnsafeLibraryPathError,
} from "./library-files.js";
import { searchLibraryDocuments } from "./library-search.js";
import type { SearchableLibraryDocument } from "./library-search.js";
import type {
  LibrarySearchOptions,
  LibrarySearchResponse,
  LibraryWarning,
} from "./library-types.js";

const libraryDiagnostics = (source: string, file: string) => {
  const configured = findConfig(path.dirname(file)) !== undefined;
  return checkSource(source, file).map((diagnostic) =>
    configured && diagnostic.code === "mdxr:unknown-component"
      ? { ...diagnostic, severity: "warning" as const }
      : diagnostic
  );
};

interface IndexedDocument {
  source: string;
  document: SearchableLibraryDocument;
  signature: string;
  warning?: LibraryWarning;
}

interface LibrarySnapshot {
  documents: IndexedDocument[];
  warnings: LibraryWarning[];
}

type LibraryRemoval =
  | { filePath: string; status: "deleted" }
  | { status: "invalid" }
  | { status: "not-found" };

interface LibraryIndex {
  remove: (id: string) => Promise<LibraryRemoval>;
  resolve: (id: string) => Promise<string | undefined>;
  search: (options?: LibrarySearchOptions) => Promise<LibrarySearchResponse>;
}

const excludedDirectories = new Set([
  ".git",
  ".mdxr-cache",
  "dist",
  "node_modules",
  "storybook-static",
]);
const markdownExtensions = new Set([".md", ".markdown", ".mdx"]);
const warningFor = (
  relativePath: string,
  reason: LibraryWarning["reason"]
): LibraryWarning => ({
  path: relativePath || ".",
  reason,
});

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

/** Index local Markdown documents without compiling or executing MDX. */
export const createLibraryIndex = async (
  root: string
): Promise<LibraryIndex> => {
  const absoluteRoot = await assertRootDirectory(root);
  let indexed = new Map<string, IndexedDocument>();
  let hasScanned = false;
  let refreshInFlight: Promise<LibrarySnapshot> | undefined;
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

  const scan = async (): Promise<LibrarySnapshot> => {
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
          const diagnostics = libraryDiagnostics(old.source, filePath);
          const document = { ...old.document, diagnostics };
          next.set(id, { ...old, document });
          if (old.warning !== undefined) {
            warnings.set(
              `${old.warning.path}\0${old.warning.reason}`,
              old.warning
            );
          }
          return;
        }

        const read = await readStableFile(absoluteRoot, filePath);
        const parsed = parseLibraryDocument(read.source, id);
        const warning = parsed.parseWarning
          ? warningFor(id, "parse")
          : undefined;
        const diagnostics = libraryDiagnostics(read.source, filePath);
        const document: SearchableLibraryDocument = {
          ...(diagnostics.length === 0 ? {} : { diagnostics }),
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
          source: read.source,
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

  const refresh = async (): Promise<LibrarySnapshot> => {
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

          if (!indexed.has(id)) {
            return { status: "not-found" } as const;
          }
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
      await withOperationLock(async (): Promise<string | undefined> => {
        if (!hasScanned) {
          await scan();
        }
        let filePath = indexed.has(id)
          ? filePathForId(absoluteRoot, id)
          : undefined;
        if (filePath !== undefined) {
          try {
            await checkedFileStat(absoluteRoot, filePath);
          } catch {
            filePath = undefined;
          }
        }
        return filePath;
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

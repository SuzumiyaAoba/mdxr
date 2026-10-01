import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import { isRecord } from "./guards.js";

export interface DependencySnapshot {
  path: string;
  hash: string | null;
  size: number;
}
export interface DependencyChange extends DependencySnapshot {
  status: "unchanged" | "changed" | "missing" | "added";
  capturedHash: string | null;
}

export const isDependencySnapshot = (
  value: unknown
): value is DependencySnapshot =>
  isRecord(value) &&
  typeof value.path === "string" &&
  (value.hash === null ||
    (typeof value.hash === "string" && /^[\da-f]{64}$/u.test(value.hash))) &&
  typeof value.size === "number" &&
  Number.isSafeInteger(value.size) &&
  value.size >= 0;

const isMissingFile = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

/** Resolve symlink aliases, retaining missing targets for deletion diagnostics. */
const canonicalPath = async (file: string): Promise<string> => {
  const absolute = path.resolve(file);
  try {
    return await realpath(absolute);
  } catch (error) {
    if (!isMissingFile(error)) {
      throw error;
    }
    try {
      return path.join(
        await realpath(path.dirname(absolute)),
        path.basename(absolute)
      );
    } catch {
      return absolute;
    }
  }
};

export const captureDependencies = async (
  files: string[],
  root: string
): Promise<DependencySnapshot[]> => {
  const canonicalRoot = await canonicalPath(root);
  const canonicalFiles = await Promise.all(files.map(canonicalPath));
  return await Promise.all(
    [...new Set(canonicalFiles)].toSorted().map(async (file) => {
      const relative = path
        .relative(canonicalRoot, file)
        .split(path.sep)
        .join("/");
      try {
        const stats = await stat(file);
        if (!stats.isFile()) {
          return { hash: null, path: relative, size: 0 };
        }
        const content = await readFile(file);
        return {
          hash: createHash("sha256").update(content).digest("hex"),
          path: relative,
          size: content.byteLength,
        };
      } catch (error) {
        if (isMissingFile(error)) {
          return { hash: null, path: relative, size: 0 };
        }
        throw error;
      }
    })
  );
};

const dependencyStatus = (
  current: string | null,
  previous: string | null | undefined
): DependencyChange["status"] => {
  if (current === null) {
    return "missing";
  }
  if (previous === null) {
    return "added";
  }
  return current === previous ? "unchanged" : "changed";
};

export const dependencyChanges = async (
  captured: DependencySnapshot[],
  root: string
): Promise<DependencyChange[]> => {
  const canonicalRoot = await canonicalPath(root);
  const known = new Map(
    await Promise.all(
      captured.map(async (entry) => {
        const file = await canonicalPath(path.resolve(root, entry.path));
        return [
          path.relative(canonicalRoot, file).split(path.sep).join("/"),
          entry,
        ] as const;
      })
    )
  );
  const current = await captureDependencies(
    captured.map((dependency) => path.resolve(root, dependency.path)),
    root
  );
  return current.map((dependency) => {
    const matched = known.get(dependency.path);
    return {
      ...dependency,
      capturedHash: matched?.hash ?? null,
      status: dependencyStatus(dependency.hash, matched?.hash),
    };
  });
};

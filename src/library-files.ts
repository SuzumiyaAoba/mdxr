import type { BigIntStats } from "node:fs";
import { constants } from "node:fs";
import { lstat, open, realpath, stat } from "node:fs/promises";
import path from "node:path";

import { isRecord } from "./guards.js";

const MAX_STABLE_READ_ATTEMPTS = 3;
// fs.open flags are bit masks, so this intentionally combines both values.
// oxlint-disable-next-line no-bitwise
const READ_FLAGS = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);

interface StableLibraryFile {
  signature: string;
  source: string;
  stats: BigIntStats;
}

export const isWithinRoot = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
};

export const filePathForId = (root: string, id: string): string | undefined => {
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

export const isMissingPathError = (error: unknown): boolean =>
  isRecord(error) && error.code === "ENOENT";

export const signatureOf = (stats: BigIntStats): string =>
  [stats.dev, stats.ino, stats.mode, stats.size, stats.mtimeNs, stats.ctimeNs]
    .map(String)
    .join(":");

export class UnsafeLibraryPathError extends Error {
  constructor() {
    super("Path is not a regular file inside the library root");
    this.name = "UnsafeLibraryPathError";
  }
}

export const checkedFileStat = async (
  root: string,
  filePath: string
): Promise<BigIntStats> => {
  if (!isWithinRoot(root, filePath) || filePath === root) {
    throw new UnsafeLibraryPathError();
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
      throw new UnsafeLibraryPathError();
    }
  }

  const actualPath = await realpath(filePath);
  if (!isWithinRoot(root, actualPath)) {
    throw new UnsafeLibraryPathError();
  }
  if (currentStats === undefined) {
    throw new UnsafeLibraryPathError();
  }
  return currentStats;
};

const readFileAttempt = async (
  root: string,
  filePath: string
): Promise<StableLibraryFile | undefined> => {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    await checkedFileStat(root, filePath);
    handle = await open(filePath, READ_FLAGS);
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile()) {
      throw new UnsafeLibraryPathError();
    }
    const source = await handle.readFile({ encoding: "utf-8" });
    const afterRead = await handle.stat({ bigint: true });
    await handle.close();
    handle = undefined;
    const current = await checkedFileStat(root, filePath);
    const afterReadSignature = signatureOf(afterRead);
    const currentSignature = signatureOf(current);
    if (
      signatureOf(opened) !== afterReadSignature ||
      afterReadSignature !== currentSignature
    ) {
      return undefined;
    }

    return { signature: currentSignature, source, stats: current };
  } finally {
    await handle?.close();
  }
};

export const readStableFile = async (
  root: string,
  filePath: string
): Promise<StableLibraryFile> => {
  for (let attempt = 0; attempt < MAX_STABLE_READ_ATTEMPTS; attempt += 1) {
    // A retry must follow the previous read and its stability check.
    // oxlint-disable-next-line no-await-in-loop
    const result = await readFileAttempt(root, filePath);
    if (result !== undefined) {
      return result;
    }
  }

  throw new Error("File changed while it was being indexed");
};

export const assertRootDirectory = async (root: string): Promise<string> => {
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

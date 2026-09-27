import { createHash, randomUUID } from "node:crypto";
import type { BigIntStats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { isRecord } from "./guards.js";

export type DocumentVersionKind = "initial" | "before-instruction" | "change";

export interface DocumentVersion {
  /** Unique capture event ID. Multiple events can refer to the same blob. */
  id: string;
  contentHash: string;
  kind: DocumentVersionKind;
  createdAt: string;
  size: number;
  sequence: number;
}

export type Version = DocumentVersion;

export interface DocumentDiffLine {
  type: "context" | "add" | "remove";
  text: string;
}

export interface DocumentHistoryList {
  versions: DocumentVersion[];
  latestId: string;
}

export interface DocumentHistory {
  capture: (kind: DocumentVersionKind) => Promise<DocumentVersion>;
  diff: (
    fromId: string,
    toId: string
  ) => Promise<{ lines: DocumentDiffLine[] }>;
  list: () => Promise<DocumentHistoryList>;
  read: (id: string) => Promise<string>;
}

export type DocumentHistoryErrorKind =
  | "invalid-version"
  | "unknown-version"
  | "corrupt-version";

export class DocumentHistoryError extends Error {
  readonly kind: DocumentHistoryErrorKind;

  constructor(kind: DocumentHistoryErrorKind, message: string) {
    super(message);
    this.name = "DocumentHistoryError";
    this.kind = kind;
  }
}

type StoredVersion = DocumentVersion;

const HASH_PATTERN = /^[\da-f]{64}$/u;
const EVENT_PATTERN =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu;
const LOCK_STALE_AFTER_MS = 10 * 60 * 1000;
const LOCK_RETRY_MS = 20;
const MAX_LOCK_WAIT_MS = 30 * 1000;
const MAX_STABLE_READS = 6;

const sha256 = (value: Buffer | string): string =>
  createHash("sha256").update(value).digest("hex");

const isNodeError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && "code" in error;

const sameFileState = (left: BigIntStats, right: BigIntStats): boolean =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.size === right.size &&
  left.mtimeNs === right.mtimeNs &&
  left.ctimeNs === right.ctimeNs;

const readStableFile = async (filePath: string): Promise<Buffer> => {
  for (let attempt = 0; attempt < MAX_STABLE_READS; attempt += 1) {
    try {
      // These reads must stay ordered to detect atomic replacement mid-read.
      // oxlint-disable-next-line no-await-in-loop
      const before = await fs.stat(filePath, { bigint: true });
      // oxlint-disable-next-line no-await-in-loop
      const content = await fs.readFile(filePath);
      // oxlint-disable-next-line no-await-in-loop
      const after = await fs.stat(filePath, { bigint: true });
      if (
        sameFileState(before, after) &&
        BigInt(content.byteLength) === after.size
      ) {
        return content;
      }
    } catch (error) {
      if (
        !isNodeError(error) ||
        (error.code !== "ENOENT" && error.code !== "EBUSY") ||
        attempt === MAX_STABLE_READS - 1
      ) {
        throw error;
      }
    }
    // oxlint-disable-next-line no-await-in-loop
    await delay(12 * (attempt + 1));
  }
  throw new Error(`Could not read a stable MDX version: ${filePath}`);
};

/** Write a file through a temporary name, then link it without replacing an
 * existing immutable file. This is safe when two preview processes race. */
const writeImmutable = async (
  filePath: string,
  content: string | Buffer
): Promise<void> => {
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, content, { flag: "wx" });
    try {
      await fs.link(temporary, filePath);
    } catch (error) {
      if (!isNodeError(error) || error.code !== "EEXIST") {
        throw error;
      }
    }
  } finally {
    await fs.rm(temporary, { force: true });
  }
};

const parseVersionKind = (value: unknown): value is DocumentVersionKind =>
  value === "initial" || value === "before-instruction" || value === "change";

const isStoredVersion = (
  value: unknown,
  expectedId: string
): value is StoredVersion => {
  if (!isRecord(value)) {
    return false;
  }
  const validHash =
    typeof value.contentHash === "string" &&
    HASH_PATTERN.test(value.contentHash);
  const validDate =
    typeof value.createdAt === "string" &&
    !Number.isNaN(Date.parse(value.createdAt));
  const validSize =
    typeof value.size === "number" &&
    Number.isSafeInteger(value.size) &&
    value.size >= 0;
  const validSequence =
    typeof value.sequence === "number" &&
    Number.isSafeInteger(value.sequence) &&
    value.sequence >= 1;
  return (
    value.id === expectedId &&
    validHash &&
    parseVersionKind(value.kind) &&
    validDate &&
    validSize &&
    validSequence
  );
};

const readVersionEvent = async (
  eventPath: string,
  expectedId: string
): Promise<StoredVersion> => {
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(eventPath, "utf-8"));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw error;
    }
    throw new DocumentHistoryError(
      "corrupt-version",
      `Could not read document history event: ${expectedId}: ${String(error)}`
    );
  }
  if (!isStoredVersion(raw, expectedId)) {
    throw new DocumentHistoryError(
      "corrupt-version",
      `Invalid document history event: ${expectedId}`
    );
  }
  return {
    contentHash: raw.contentHash,
    createdAt: raw.createdAt,
    id: raw.id,
    kind: raw.kind,
    sequence: raw.sequence,
    size: raw.size,
  };
};

const removeStaleLock = async (lockPath: string): Promise<boolean> => {
  try {
    const stat = await fs.stat(lockPath);
    if (Date.now() - stat.mtimeMs <= LOCK_STALE_AFTER_MS) {
      return false;
    }
    await fs.rm(lockPath, { force: true });
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

const acquireLock = async (lockPath: string): Promise<() => Promise<void>> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < MAX_LOCK_WAIT_MS) {
    try {
      // Lock acquisition and stale-lock recovery must be ordered.
      // oxlint-disable-next-line no-await-in-loop
      const handle = await fs.open(lockPath, "wx", 0o600);
      // oxlint-disable-next-line no-await-in-loop
      await handle.writeFile(`${process.pid}\n${Date.now()}\n`);
      return async () => {
        await handle.close();
        await fs.rm(lockPath, { force: true });
      };
    } catch (error) {
      if (!isNodeError(error) || error.code !== "EEXIST") {
        throw error;
      }
      // oxlint-disable-next-line no-await-in-loop
      if (await removeStaleLock(lockPath)) {
        continue;
      }
      // oxlint-disable-next-line no-await-in-loop
      await delay(LOCK_RETRY_MS);
    }
  }
  throw new Error("Timed out waiting for the MDX history lock");
};

const versionBlobPath = (
  versionsPath: string,
  version: StoredVersion
): string => path.join(versionsPath, `${version.contentHash}.mdx`);

const verifyVersionContent = (
  content: Buffer,
  version: StoredVersion,
  id: string
): Buffer => {
  if (sha256(content) !== version.contentHash) {
    throw new DocumentHistoryError(
      "corrupt-version",
      `Corrupt document history version: ${id}`
    );
  }
  return content;
};

const readVersionContent = async (
  versionsPath: string,
  version: StoredVersion,
  id: string
): Promise<Buffer> => {
  const content = await fs.readFile(versionBlobPath(versionsPath, version));
  return verifyVersionContent(content, version, id);
};

const lines = (source: string): string[] =>
  source.replaceAll("\r\n", "\n").split("\n");

const shouldMoveDown = (
  diagonal: number,
  distance: number,
  frontier: Map<number, number>
): boolean =>
  diagonal === -distance ||
  (diagonal !== distance &&
    (frontier.get(diagonal - 1) ?? Number.NEGATIVE_INFINITY) <
      (frontier.get(diagonal + 1) ?? Number.NEGATIVE_INFINITY));

const extendMatchingLines = (
  left: string[],
  right: string[],
  startX: number,
  diagonal: number
): number => {
  let x = startX;
  let y = x - diagonal;
  while (x < left.length && y < right.length && left[x] === right[y]) {
    x += 1;
    y += 1;
  }
  return x;
};

const buildMyersTrace = (
  left: string[],
  right: string[]
): Map<number, number>[] => {
  const maxDistance = left.length + right.length;
  const trace: Map<number, number>[] = [];
  const frontier = new Map<number, number>([[1, 0]]);
  for (let distance = 0; distance <= maxDistance; distance += 1) {
    trace.push(new Map(frontier));
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const startX = shouldMoveDown(diagonal, distance, frontier)
        ? (frontier.get(diagonal + 1) ?? 0)
        : (frontier.get(diagonal - 1) ?? 0) + 1;
      const x = extendMatchingLines(left, right, startX, diagonal);
      const y = x - diagonal;
      frontier.set(diagonal, x);
      if (x >= left.length && y >= right.length) {
        return trace;
      }
    }
  }
  return trace;
};

const appendContextLines = (
  left: string[],
  start: { x: number; y: number },
  previousX: number,
  previousY: number,
  reversed: DocumentDiffLine[]
): { x: number; y: number } => {
  let { x, y } = start;
  while (x > previousX && y > previousY) {
    reversed.push({ text: left[x - 1] ?? "", type: "context" });
    x -= 1;
    y -= 1;
  }
  return { x, y };
};

const reconstructMyersDiff = (
  left: string[],
  right: string[],
  trace: Map<number, number>[]
): DocumentDiffLine[] => {
  let x = left.length;
  let y = right.length;
  const reversed: DocumentDiffLine[] = [];
  for (let distance = trace.length - 1; distance >= 0; distance -= 1) {
    const previous = trace[distance];
    if (previous === undefined) {
      continue;
    }
    const diagonal = x - y;
    const previousDiagonal = shouldMoveDown(diagonal, distance, previous)
      ? diagonal + 1
      : diagonal - 1;
    const previousX = previous.get(previousDiagonal) ?? 0;
    const previousY = previousX - previousDiagonal;
    ({ x, y } = appendContextLines(
      left,
      { x, y },
      previousX,
      previousY,
      reversed
    ));

    if (distance === 0) {
      break;
    }
    if (x === previousX) {
      reversed.push({ text: right[y - 1] ?? "", type: "add" });
      y -= 1;
    } else {
      reversed.push({ text: left[x - 1] ?? "", type: "remove" });
      x -= 1;
    }
  }
  return reversed.toReversed();
};

/** Myers shortest edit script with O((N + M)D) time and trace backtracking. */
const diffLines = (before: string, after: string): DocumentDiffLine[] => {
  const left = lines(before);
  const right = lines(after);
  return reconstructMyersDiff(left, right, buildMyersTrace(left, right));
};

const eventCompare = (left: DocumentVersion, right: DocumentVersion): number =>
  left.sequence - right.sequence;

/** Local, token-free snapshots and line diffs for one MDX source file. */
export const createDocumentHistory = (
  filePath: string,
  rootDir = process.cwd()
): DocumentHistory => {
  const absoluteFilePath = path.resolve(filePath);
  const historyPath = path.join(
    path.resolve(rootDir),
    ".mdxr",
    "history",
    sha256(absoluteFilePath)
  );
  const versionsPath = path.join(historyPath, "versions");
  const eventsPath = path.join(historyPath, "events");
  const lockPath = path.join(historyPath, ".capture.lock");

  const listUnlocked = async (): Promise<DocumentHistoryList> => {
    await fs.mkdir(eventsPath, { recursive: true });
    const entries = await fs.readdir(eventsPath, { withFileTypes: true });
    const eventEntries = entries.filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".json") &&
        EVENT_PATTERN.test(entry.name.replace(/\.json$/u, ""))
    );
    const versions = await Promise.all(
      eventEntries.map(async (entry): Promise<DocumentVersion> => {
        const eventId = entry.name.slice(0, -".json".length);
        const version = await readVersionEvent(
          path.join(eventsPath, entry.name),
          eventId
        );
        return {
          contentHash: version.contentHash,
          createdAt: version.createdAt,
          id: version.id,
          kind: version.kind,
          sequence: version.sequence,
          size: version.size,
        };
      })
    );
    versions.sort(eventCompare);
    return {
      latestId: versions.at(-1)?.id ?? "",
      versions,
    };
  };

  const findVersion = async (id: string): Promise<StoredVersion> => {
    if (!EVENT_PATTERN.test(id)) {
      throw new DocumentHistoryError(
        "invalid-version",
        `Invalid document history version ID: ${id}`
      );
    }
    const canonicalId = id.toLowerCase();
    const eventPath = path.join(eventsPath, `${canonicalId}.json`);
    try {
      return await readVersionEvent(eventPath, canonicalId);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        throw new DocumentHistoryError(
          "unknown-version",
          `Unknown document history version: ${id}`
        );
      }
      throw error;
    }
  };

  return {
    capture: async (kind: DocumentVersionKind): Promise<DocumentVersion> => {
      await fs.mkdir(versionsPath, { recursive: true });
      const release = await acquireLock(lockPath);
      try {
        const content = await readStableFile(absoluteFilePath);
        const contentHash = sha256(content);
        const current = await listUnlocked();
        const latest = current.versions.at(-1);
        if (
          kind !== "before-instruction" &&
          latest?.contentHash === contentHash
        ) {
          return latest;
        }

        const blobPath = path.join(versionsPath, `${contentHash}.mdx`);
        await writeImmutable(blobPath, content);

        const version: StoredVersion = {
          contentHash,
          createdAt: new Date().toISOString(),
          id: randomUUID(),
          kind,
          sequence: (latest?.sequence ?? 0) + 1,
          size: content.byteLength,
        };
        const eventPath = path.join(eventsPath, `${version.id}.json`);
        await writeImmutable(eventPath, JSON.stringify(version));
        return version;
      } finally {
        await release();
      }
    },

    diff: async (
      fromId: string,
      toId: string
    ): Promise<{ lines: DocumentDiffLine[] }> => {
      const [from, to] = await Promise.all([
        findVersion(fromId),
        findVersion(toId),
      ]);
      const [beforeContent, afterContent] = await Promise.all([
        fs.readFile(versionBlobPath(versionsPath, from)),
        fs.readFile(versionBlobPath(versionsPath, to)),
      ]);
      const before = verifyVersionContent(beforeContent, from, fromId);
      const after = verifyVersionContent(afterContent, to, toId);
      return {
        lines: diffLines(before.toString("utf-8"), after.toString("utf-8")),
      };
    },

    list: async (): Promise<DocumentHistoryList> => await listUnlocked(),

    read: async (id: string): Promise<string> => {
      const version = await findVersion(id);
      const content = await readVersionContent(versionsPath, version, id);
      return content.toString("utf-8");
    },
  };
};

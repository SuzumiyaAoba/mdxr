import fs from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const LOCK_STALE_AFTER_MS = 10 * 60 * 1000;
const LOCK_RETRY_MS = 20;
const MAX_LOCK_WAIT_MS = 30 * 1000;

const isNodeError = (error: unknown): error is NodeJS.ErrnoException =>
  error instanceof Error && "code" in error;

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

/** Serialize read-modify-write operations across preview processes. */
export const acquireFileLock = async (
  lockPath: string,
  label: string
): Promise<() => Promise<void>> => {
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
  throw new Error(`Timed out waiting for the ${label} lock`);
};

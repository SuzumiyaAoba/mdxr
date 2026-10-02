import { stat } from "node:fs/promises";
import path from "node:path";

import { checkDocuments } from "./check.js";
import type { CheckOptions, CheckResult } from "./check.js";
import { findConfig } from "./config.js";
import { createPreviewWatcher } from "./preview-watch.js";

/** Serialized, debounced validation. close() releases every watcher. */
export const watchDocuments = async (
  input: string,
  options: CheckOptions,
  onResult: (result: CheckResult) => void
): Promise<{ close: () => void }> => {
  const target = path.resolve(input);
  const stats = await stat(target);
  let closed = false;
  let running = Promise.resolve();
  const watchState: { watcher?: ReturnType<typeof createPreviewWatcher> } = {};
  const check = async (): Promise<void> => {
    const dependencies = new Set<string>();
    const result = await checkDocuments(target, {
      ...options,
      onDependencies: (paths) => {
        for (const file of paths) {
          dependencies.add(file);
        }
        options.onDependencies?.(paths);
      },
    });
    for (const file of result.files) {
      const config = findConfig(path.dirname(file), options);
      if (config !== undefined) {
        dependencies.add(config);
      }
    }
    if (!closed) {
      watchState.watcher?.armDependencies([...dependencies]);
      onResult(result);
    }
  };
  const watcher = createPreviewWatcher(
    {
      includeMdxrDocuments: true,
      watchDir: stats.isDirectory() ? target : path.dirname(target),
      watchFile: stats.isFile() ? target : undefined,
    },
    () => {
      const previous = running;
      running = (async () => {
        await previous;
        if (closed) {
          return;
        }
        try {
          await check();
        } catch (error) {
          onResult({
            diagnostics: [
              {
                code: "mdxr:watch",
                column: 1,
                file: target,
                line: 1,
                message: error instanceof Error ? error.message : String(error),
                severity: "error",
              },
            ],
            errors: 1,
            files: [],
            ok: false,
            warnings: 0,
          });
        }
      })();
    }
  );
  watchState.watcher = watcher;
  try {
    running = check();
    await running;
  } catch (error) {
    watcher?.close();
    throw error;
  }
  return {
    close: () => {
      closed = true;
      watcher?.close();
    },
  };
};

import fs from "node:fs";
import path from "node:path";

interface PreviewWatchTarget {
  includeMdxrDocuments?: boolean;
  watchDir: string;
  watchFile?: string;
}

type WatchListener = (
  event?: string,
  filename?: string | null,
  directory?: string
) => void;

/** Dependency/build output dirs — never worth a watch fd. */
const SKIP_DIRS = new Set([
  ".git",
  ".mdxr-cache",
  "dist",
  "node_modules",
  "storybook-static",
]);

/**
 * The set of directories being watched. `fs.watch` recursive mode exists only
 * on darwin/win32 — elsewhere `arm` puts one non-recursive watcher per
 * directory, which also survives atomic saves (rename-over kills a watch
 * aimed at the file itself).
 */
const createWatchSet = () => {
  const watchers: fs.FSWatcher[] = [];
  const armed = new Set<string>();

  const track = (w: fs.FSWatcher, dir?: string): void => {
    watchers.push(w);
    if (dir !== undefined) {
      armed.add(dir);
      // A deleted dir kills its watcher — un-arm on close so a recreated
      // dir is picked up again by the next event's re-scan.
      w.on("close", () => {
        armed.delete(dir);
      });
    }
    w.on("error", () => {
      w.close();
    });
  };

  /** One watcher on `dir` itself (no descent). */
  const armFlat = (dir: string, onEvent: WatchListener): void => {
    if (armed.has(dir) || SKIP_DIRS.has(path.basename(dir))) {
      return;
    }
    try {
      track(
        fs.watch(dir, (event, filename) => {
          onEvent(event, filename, dir);
        }),
        dir
      );
    } catch {
      // Directory gone or unwatched — skip.
    }
  };

  /**
   * Recursive fallback: a watcher on `dir` plus every directory under it.
   * The `armed` check guards only the watcher install — the descent still
   * runs on an already-armed root, so directories created mid-session get
   * picked up on the next rebuild (armDependencies re-arms the tree).
   */
  const arm = (dir: string, onEvent: WatchListener): void => {
    if (
      SKIP_DIRS.has(path.basename(dir)) ||
      (path.basename(dir) === "history" &&
        path.basename(path.dirname(dir)) === ".mdxr")
    ) {
      return;
    }
    if (!armed.has(dir)) {
      try {
        track(
          fs.watch(dir, (event, filename) => {
            onEvent(event, filename, dir);
          }),
          dir
        );
      } catch {
        // Watch failed (dir gone, fd limit) — children may still be
        // watchable, so keep descending.
      }
    }
    let ents: fs.Dirent[];
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      if (e.isDirectory()) {
        arm(path.join(dir, e.name), onEvent);
      }
    }
  };

  return {
    arm,
    armFlat,
    close(): void {
      for (const w of watchers) {
        w.close();
      }
    },
    get size(): number {
      return watchers.length;
    },
    track,
  };
};

const watchTarget = (
  watch: ReturnType<typeof createWatchSet>,
  target: PreviewWatchTarget,
  notify: WatchListener
): boolean => {
  let recursiveWatch = false;
  // fs.watch recursive mode exists only on darwin/win32; elsewhere `arm`
  // installs the per-directory fallback.
  try {
    watch.track(fs.watch(target.watchDir, { recursive: true }, notify));
    recursiveWatch = true;
  } catch {
    watch.arm(target.watchDir, notify);
  }
  if (watch.size === 0 && target.watchFile !== undefined) {
    try {
      watch.track(fs.watch(target.watchFile, notify));
    } catch {
      // Live reload just won't fire; the server still serves the document.
    }
  }
  return recursiveWatch;
};

const RELOAD_DEBOUNCE_MS = 80;
const SESSION_TEMP_FILE = /^\.sessions-.*\.tmp$/u;

const fileSignature = (file: string): string | undefined => {
  try {
    const stats = fs.statSync(file, { bigint: true });
    return [
      stats.dev,
      stats.ino,
      stats.size,
      stats.mtimeNs,
      stats.ctimeNs,
    ].join(":");
  } catch {
    return undefined;
  }
};

const canonicalPath = (file: string): string => {
  try {
    return fs.realpathSync(file);
  } catch {
    return path.resolve(file);
  }
};

/** Ignore delayed/duplicate events for files whose observed state is unchanged. */
const createFileState = () => {
  const signatures = new Map<string, string | undefined>();
  const remember = (file: string): void => {
    const signature = fileSignature(file);
    for (const alias of [path.resolve(file), canonicalPath(file)]) {
      if (!signatures.has(alias)) {
        signatures.set(alias, signature);
      }
    }
  };
  const rememberTree = (directory: string): void => {
    remember(directory);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (
        SKIP_DIRS.has(entry.name) ||
        (entry.name === "history" && path.basename(directory) === ".mdxr")
      ) {
        continue;
      }
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        rememberTree(file);
      } else {
        remember(file);
      }
    }
  };
  return {
    hasChanged(paths: string[]): boolean {
      const known = paths.find((file) => signatures.has(file));
      if (known === undefined) {
        return true;
      }
      const current = fileSignature(known);
      if (current === signatures.get(known)) {
        return false;
      }
      for (const file of paths) {
        signatures.set(file, current);
      }
      return true;
    },
    remember,
    rememberTree,
  };
};

const isIgnoredChange = (
  target: PreviewWatchTarget,
  filename: string | null | undefined,
  tracked: boolean
): boolean => {
  const { watchDir } = target;
  const parts = filename?.split(path.sep) ?? [];
  const isHistoryWrite =
    parts.includes("history") &&
    (parts.includes(".mdxr") || path.basename(watchDir) === ".mdxr");
  const isInternalMdxrWrite =
    target.includeMdxrDocuments !== true &&
    !tracked &&
    path.basename(watchDir) !== ".mdxr" &&
    parts.includes(".mdxr");
  return (
    parts.some((part) => SKIP_DIRS.has(part)) ||
    isHistoryWrite ||
    isInternalMdxrWrite ||
    parts.some(
      (part) =>
        part === "sessions.json" ||
        part === ".sessions.lock" ||
        SESSION_TEMP_FILE.test(part)
    )
  );
};

/** Own the preview's filesystem watchers and debounce source change bursts. */
export const createPreviewWatcher = (
  target: PreviewWatchTarget,
  onChange: () => void
) => {
  const watch = createWatchSet();
  const dependencies = new Set<string>();
  const fileState = createFileState();
  const canonicalDir = canonicalPath(target.watchDir);
  // Dependencies are only known after rendering. Snapshot existing files now
  // so delayed startup events cannot queue a reload during the initial render.
  fileState.rememberTree(target.watchDir);
  if (target.watchFile !== undefined) {
    fileState.remember(target.watchFile);
  }
  let closed = false;
  let timer: NodeJS.Timeout | undefined;
  const notify: WatchListener = (
    event,
    filename,
    directory = target.watchDir
  ): void => {
    const paths =
      filename === undefined || filename === null
        ? []
        : [
            path.resolve(directory, filename),
            path.resolve(canonicalPath(directory), filename),
          ];
    const tracked = paths.some((file) => dependencies.has(file));
    const [eventPath] = paths;
    const relative =
      eventPath === undefined
        ? filename
        : path.relative(target.watchDir, eventPath);
    if (closed || isIgnoredChange(target, relative, tracked)) {
      return;
    }
    if (
      event === "change" &&
      filename === path.basename(directory) &&
      !fs.existsSync(eventPath ?? "")
    ) {
      // Darwin can report the watched directory's own metadata under its
      // basename. Child edits have their own events; this is not a child.
      return;
    }
    if (!fileState.hasChanged(paths)) {
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(onChange, RELOAD_DEBOUNCE_MS);
  };
  const recursiveWatch = watchTarget(watch, target, notify);

  return {
    /** Watch external dependencies and newly created source directories. */
    armDependencies(paths: string[]): void {
      if (closed) {
        return;
      }
      dependencies.clear();
      for (const dependency of paths) {
        dependencies.add(path.resolve(dependency));
        fileState.remember(dependency);
      }
      if (!recursiveWatch) {
        watch.arm(target.watchDir, notify);
      }
      for (const dependency of paths) {
        const directory = path.dirname(dependency);
        const canonical = canonicalPath(directory);
        const inside =
          canonical === canonicalDir ||
          canonical.startsWith(`${canonicalDir}${path.sep}`);
        if (inside || directory.split(path.sep).includes("node_modules")) {
          continue;
        }
        // Flat directory watches survive atomic saves without descending into
        // an external dependency's potentially large ancestor tree.
        watch.armFlat(directory, notify);
      }
    },
    close(): void {
      closed = true;
      clearTimeout(timer);
      watch.close();
    },
  };
};

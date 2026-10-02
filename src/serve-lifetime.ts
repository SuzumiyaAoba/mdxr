import type http from "node:http";

/** Allow reloads and brief disconnects without leaving unused previews running. */
export const DEFAULT_IDLE_TIMEOUT = 300;
const MAX_TIMEOUT_SECONDS = 2_147_483_647 / 1000;
const SHUTDOWN_GRACE_MS = 5000;

export interface ServerLifetime {
  hold: () => () => void;
}

export interface ServerLifetimeOptions {
  /** Seconds without a browser connection or active work; 0 disables expiry. */
  idleTimeout?: number;
  /** Keep the containing library alive while a document is in use. */
  parentLifetime?: ServerLifetime;
}

export const parseIdleTimeout = (
  value: number | string = DEFAULT_IDLE_TIMEOUT
): number => {
  const seconds = Number(value);
  if (
    !Number.isFinite(seconds) ||
    seconds < 0 ||
    seconds > MAX_TIMEOUT_SECONDS
  ) {
    throw new Error(`invalid --idle-timeout: ${value}`);
  }
  return seconds;
};

/** Stop accepting requests before dropping long-lived SSE connections. */
export const closePreviewServer = (server: http.Server): void => {
  server.close();
  server.closeAllConnections();
};

/** Browser streams, requests and agent turns all count as active work. */
export const createServerLifetime = (
  server: http.Server,
  options: ServerLifetimeOptions = {}
): ServerLifetime => {
  const timeout = parseIdleTimeout(options.idleTimeout) * 1000;
  let active = 0;
  let closed = false;
  let timer: NodeJS.Timeout | undefined;

  const arm = (): void => {
    clearTimeout(timer);
    if (closed || !server.listening || active > 0 || timeout === 0) {
      return;
    }
    timer = setTimeout(() => {
      console.log("mdxr: closing idle preview");
      closePreviewServer(server);
    }, timeout);
    timer.unref();
  };

  const hold = (): (() => void) => {
    if (closed) {
      return () => {
        // Late work cannot keep an already closed server or its parent alive.
      };
    }
    active += 1;
    clearTimeout(timer);
    const releaseParent = options.parentLifetime?.hold();
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      active -= 1;
      releaseParent?.();
      arm();
    };
  };

  server.on("request", (_request, response) => {
    const release = hold();
    response.once("finish", release);
    response.once("close", release);
  });
  server.once("listening", arm);
  server.once("close", () => {
    closed = true;
    clearTimeout(timer);
  });
  return { hold };
};

/** Install only for CLI-owned servers; embedded servers do not own the process. */
export const handlePreviewSignals = (server: http.Server): void => {
  const signals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
  let stopping = false;
  const stop = (): void => {
    if (stopping) {
      return;
    }
    stopping = true;
    closePreviewServer(server);
  };
  for (const signal of signals) {
    process.on(signal, stop);
  }
  server.once("close", () => {
    for (const signal of signals) {
      process.off(signal, stop);
    }
    // Bound transport cleanup after both idle expiry and an explicit stop.
    const deadline = setTimeout(() => {
      process.exit(0);
    }, SHUTDOWN_GRACE_MS);
    deadline.unref();
  });
};

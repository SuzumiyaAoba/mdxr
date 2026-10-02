import { once } from "node:events";
import http from "node:http";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closePreviewServer,
  createServerLifetime,
  DEFAULT_IDLE_TIMEOUT,
  parseIdleTimeout,
} from "../src/serve-lifetime.js";
import type { ServerLifetimeOptions } from "../src/serve-lifetime.js";

describe("preview lifetime", () => {
  const servers: http.Server[] = [];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(async () => {
    for (const server of servers.splice(0)) {
      if (server.listening) {
        const closed = once(server, "close");
        closePreviewServer(server);
        // oxlint-disable-next-line no-await-in-loop -- Close each owned listener before restoring timers.
        await closed;
      }
    }
    vi.useRealTimers();
  });

  const start = async (options: ServerLifetimeOptions = {}) => {
    const server = http.createServer();
    servers.push(server);
    const lifetime = createServerLifetime(server, options);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    return { lifetime, server };
  };

  it("closes an unused server after five minutes by default", async () => {
    const { server } = await start();
    await vi.advanceTimersByTimeAsync(DEFAULT_IDLE_TIMEOUT * 1000 - 1);
    expect(server.listening).toBeTruthy();
    const closed = once(server, "close");
    await vi.advanceTimersByTimeAsync(1);
    await closed;
    expect(server.listening).toBeFalsy();
  });

  it("starts a fresh grace period after the last activity ends", async () => {
    const { lifetime, server } = await start({ idleTimeout: 1 });
    const releaseFirst = lifetime.hold();
    const releaseSecond = lifetime.hold();
    releaseFirst();
    releaseFirst();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(server.listening).toBeTruthy();
    releaseSecond();
    await vi.advanceTimersByTimeAsync(999);
    expect(server.listening).toBeTruthy();
    const closed = once(server, "close");
    await vi.advanceTimersByTimeAsync(1);
    await closed;
    expect(server.listening).toBeFalsy();
  });

  it("keeps a library alive while any document is in use", async () => {
    const parent = await start({ idleTimeout: 1 });
    const child = await start({
      idleTimeout: 1,
      parentLifetime: parent.lifetime,
    });
    const release = child.lifetime.hold();
    await vi.advanceTimersByTimeAsync(10_000);
    expect([parent.server.listening, child.server.listening]).toStrictEqual([
      true,
      true,
    ]);
    release();
    const closed = Promise.all([
      once(parent.server, "close"),
      once(child.server, "close"),
    ]);
    await vi.advanceTimersByTimeAsync(1000);
    await closed;
    expect([parent.server.listening, child.server.listening]).toStrictEqual([
      false,
      false,
    ]);
  });

  it("cancels expiry when work resumes during the grace period", async () => {
    const { lifetime, server } = await start({ idleTimeout: 1 });
    await vi.advanceTimersByTimeAsync(900);
    const release = lifetime.hold();
    await vi.advanceTimersByTimeAsync(2000);
    expect(server.listening).toBeTruthy();
    release();
    await vi.advanceTimersByTimeAsync(900);
    expect(server.listening).toBeTruthy();
  });

  it("supports disabling automatic shutdown", async () => {
    const { server } = await start({ idleTimeout: 0 });
    await vi.advanceTimersByTimeAsync(86_400_000);
    expect(server.listening).toBeTruthy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 2_147_484, "bad"])(
    "rejects invalid idle timeout %s instead of overflowing the timer",
    (timeout) => {
      expect(() => parseIdleTimeout(timeout)).toThrow("invalid --idle-timeout");
    }
  );
});

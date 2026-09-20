import { spawn } from "node:child_process";
import { once } from "node:events";

import { formatError } from "./format-error.js";

interface BrowserCommand {
  args: string[];
  command: string;
}

/**
 * The platform's "open in the default browser" invocation for a file path
 * or URL: `open` on macOS, the `start` builtin on Windows, and the
 * freedesktop `xdg-open` elsewhere (Linux, BSD).
 */
export const browserCommand = (
  target: string,
  platform: NodeJS.Platform = process.platform
): BrowserCommand => {
  if (platform === "darwin") {
    return { args: [target], command: "open" };
  }
  if (platform === "win32") {
    // `start` treats its first quoted argument as a window title — pass an
    // empty title so the target is always parsed as the thing to open.
    return { args: ["/c", "start", "", target], command: "cmd" };
  }
  return { args: [target], command: "xdg-open" };
};

/**
 * Open `target` (a file path or URL) in the system default browser.
 * Resolves once the launcher has spawned, then detaches — the opener
 * (`open`/`xdg-open`/`start`) exits on its own and the unref'd child never
 * holds the CLI's event loop. A spawn failure (e.g. no `xdg-open` on a
 * headless box) warns on stderr instead of rejecting: by then the document
 * was already produced, so a failed open must never fail the command.
 */
export const openInBrowser = async (target: string): Promise<void> => {
  const { args, command } = browserCommand(target);
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  try {
    await once(child, "spawn");
  } catch (error) {
    process.stderr.write(
      `mdxr: warning: could not open ${target} in a browser: ${formatError(error)}\n`
    );
  }
  child.unref();
};

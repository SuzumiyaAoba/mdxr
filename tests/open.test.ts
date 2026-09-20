import { describe, expect, it } from "vitest";

import { browserCommand } from "../src/open.js";

describe(browserCommand, () => {
  it("uses `open` on macOS", () => {
    expect(browserCommand("/tmp/doc.html", "darwin")).toStrictEqual({
      args: ["/tmp/doc.html"],
      command: "open",
    });
  });

  it("goes through cmd's `start` builtin on Windows", () => {
    // `start` eats its first quoted arg as the window title — the empty
    // string keeps the target parsed as what to open.
    expect(browserCommand(String.raw`C:\docs\doc.html`, "win32")).toStrictEqual(
      {
        args: ["/c", "start", "", String.raw`C:\docs\doc.html`],
        command: "cmd",
      }
    );
  });

  it("uses `xdg-open` on Linux and other non-desktop platforms", () => {
    for (const platform of ["freebsd", "linux", "openbsd"] as const) {
      expect(browserCommand("http://localhost:3737", platform)).toStrictEqual({
        args: ["http://localhost:3737"],
        command: "xdg-open",
      });
    }
  });
});

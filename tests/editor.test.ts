import { describe, expect, it } from "vitest";

import { editorUrl } from "../src/editor.js";

describe(editorUrl, () => {
  it("defaults to vscode when editor is undefined or empty", () => {
    expect(editorUrl(undefined, "/repo/a.ts")).toBe("vscode://file/repo/a.ts");
    expect(editorUrl("", "/repo/a.ts")).toBe("vscode://file/repo/a.ts");
  });

  it("appends the line number for scheme://file editors", () => {
    expect(editorUrl("vscode", "/repo/a.ts", "12")).toBe(
      "vscode://file/repo/a.ts:12"
    );
    expect(editorUrl("zed", "/repo/a.ts", "3")).toBe("zed://file/repo/a.ts:3");
  });

  it("returns undefined for none", () => {
    expect(editorUrl("none", "/repo/a.ts", "9")).toBeUndefined();
  });

  it("expands {path}/{line} URL templates", () => {
    expect(editorUrl("myed://open?f={path}&l={line}", "/repo/a.ts", "7")).toBe(
      "myed://open?f=/repo/a.ts&l=7"
    );
    // A missing line expands to an empty string, not the literal braces.
    expect(editorUrl("myed://open?f={path}&l={line}", "/repo/a.ts")).toBe(
      "myed://open?f=/repo/a.ts&l="
    );
  });

  it("treats an unknown name as a scheme://file editor", () => {
    expect(editorUrl("nova", "/repo/a.ts", "4")).toBe(
      "nova://file/repo/a.ts:4"
    );
  });

  it("URI-encodes paths with spaces", () => {
    expect(editorUrl("vscode", "/repo/my dir/a.ts")).toBe(
      "vscode://file/repo/my%20dir/a.ts"
    );
  });
});

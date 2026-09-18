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

  it("percent-encodes URL delimiters inside filenames (#, ?, %, &)", () => {
    expect(editorUrl("vscode", "/repo/a#b.ts")).toBe(
      "vscode://file/repo/a%23b.ts"
    );
    expect(editorUrl("vscode", "/repo/a?b.ts")).toBe(
      "vscode://file/repo/a%3Fb.ts"
    );
    expect(editorUrl("vscode", "/repo/a%b.ts")).toBe(
      "vscode://file/repo/a%25b.ts"
    );
    expect(editorUrl("vscode", "/repo/a&b.ts")).toBe(
      "vscode://file/repo/a%26b.ts"
    );
    // idea builds a ?file= query — a raw # inside would become a fragment.
    expect(editorUrl("idea", "/repo/a#b.ts")).toBe(
      "idea://open?file=/repo/a%23b.ts"
    );
  });

  it("encodes {path} inside URL templates the same way", () => {
    expect(editorUrl("myed://open?f={path}", "/repo/a#b.ts")).toBe(
      "myed://open?f=/repo/a%23b.ts"
    );
  });

  it("returns undefined for names that cannot be URI schemes", () => {
    expect(editorUrl("not a scheme", "/repo/a.ts")).toBeUndefined();
    expect(editorUrl("has space", "/repo/a.ts")).toBeUndefined();
  });

  it("refuses scriptable schemes — `editor` can come from frontmatter", () => {
    /* oxlint-disable no-script-url -- the probes are the attack */
    // Bare names become `scheme://file` URLs — `javascript`/`data`/`vbscript`
    // must not mint a clickable anchor.
    expect(editorUrl("javascript", "/repo/a.ts")).toBeUndefined();
    expect(editorUrl("data", "/repo/a.ts")).toBeUndefined();
    expect(editorUrl("vbscript", "/repo/a.ts")).toBeUndefined();
    // Templates expand to a URL — the scheme of the *result* is what matters.
    expect(
      editorUrl("javascript:alert(1)//{path}", "/repo/a.ts")
    ).toBeUndefined();
    expect(
      editorUrl("data:text/html,<script>x</script>#{path}", "/repo/a.ts")
    ).toBeUndefined();
    /* oxlint-enable no-script-url */
  });

  it("still allows custom non-scriptable schemes", () => {
    expect(editorUrl("nova://open?f={path}", "/repo/a.ts")).toBe(
      "nova://open?f=/repo/a.ts"
    );
    expect(editorUrl("nova", "/repo/a.ts")).toBe("nova://file/repo/a.ts");
  });
});

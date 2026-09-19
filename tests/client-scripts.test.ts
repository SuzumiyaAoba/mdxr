import vm from "node:vm";

import { transformSync } from "esbuild";
import { describe, expect, it } from "vitest";

import { LIVE_RELOAD_JS, MERMAID_JS, THEME_JS } from "../src/assets/scripts.js";
import { clientJs } from "../src/client-js.js";
import { inlineScript } from "../src/html.js";

/**
 * Smoke tests for every script inlined into rendered documents: a syntax
 * slip here silently breaks every emitted page, so each snippet gets parsed
 * — `vm.Script` for classic scripts, esbuild's parser for the module-syntax
 * mermaid bootstrap (which `vm.Script` can't take because of `import`).
 */

describe(clientJs, () => {
  it("bundles src/client into a parseable IIFE", async () => {
    const js = await clientJs();
    expect(() => new vm.Script(js)).not.toThrow();
    expect(js).toContain("addEventListener");
    // The delegated behaviors the markup depends on.
    expect(js).toContain("data-copy");
    expect(js).toContain("data-ask");
    expect(js).toContain("data-mdxr-theme");
  });

  it("wires the board interactions (drag, move, copy)", async () => {
    const js = await clientJs();
    for (const s of [
      "data-board-card",
      "data-board-lane",
      "data-board-move",
      "data-board-copy",
      "dragstart",
    ]) {
      expect(js).toContain(s);
    }
  });

  it("wires the comments interactions (add, reply, submit, copy)", async () => {
    const js = await clientJs();
    for (const s of [
      "data-comment-add",
      "data-comment-reply",
      "data-comment-submit",
      "data-comment-cancel",
      "data-comment-tpl",
      "data-mdxr-comment",
      "data-comments-copy",
      // The fence payload is read via dataset — the property name survives.
      "commentsCode",
      "keydown",
    ]) {
      expect(js).toContain(s);
    }
  });

  it("is memoized", async () => {
    await expect(clientJs()).resolves.toBe(await clientJs());
  });
});

describe("inline script snippets", () => {
  it("THEME_JS parses", () => {
    expect(() => new vm.Script(THEME_JS)).not.toThrow();
  });

  it("LIVE_RELOAD_JS parses", () => {
    expect(() => new vm.Script(LIVE_RELOAD_JS)).not.toThrow();
  });

  it("MERMAID_JS parses as a module", () => {
    // `import`/`await` make this a module — parse it via esbuild.
    expect(() =>
      transformSync(MERMAID_JS, { format: "esm", loader: "js" })
    ).not.toThrow();
  });
});

describe(inlineScript, () => {
  it("neutralizes HTML parser terminators", () => {
    expect(inlineScript('const s = "</script>";')).toContain("\\u003C/script");
    expect(inlineScript("<!-- comment")).toContain("\\u003C!--");
    expect(inlineScript("a < b")).toBe("a < b");
  });
});

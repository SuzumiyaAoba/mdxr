import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkspaceCode } from "../src/workspace-code.js";
import type { DiffWordToken } from "../src/workspace-diff-model.js";
import type { SyntaxToken } from "../src/workspace-syntax.js";

const visibleText = (markup: string): string =>
  markup.replaceAll(/<[^>]*>/gu, "");

const syntaxToken = (text: string): SyntaxToken => ({
  style: {
    "--shiki-dark": "#d4d4d4",
    "--shiki-light": "#404040",
  },
  text,
});

describe("workspace code rendering", () => {
  it("combines intersecting syntax and word diff spans without changing Unicode text", () => {
    const text = "const 更新 = 猫 🐈;";
    const words: DiffWordToken[] = [
      { kind: "context", text: "const " },
      { kind: "add", text: "更新" },
      { kind: "context", text: " = 猫 🐈;" },
    ];
    const html = renderToStaticMarkup(
      createElement(WorkspaceCode, {
        syntax: [syntaxToken("const 更新"), syntaxToken(" = 猫 🐈;")],
        text,
        words,
      })
    );

    expect(visibleText(html)).toBe(text);
    expect(html).toContain(
      'class="mdxr-workspace-syntax mdxr-workspace-diff-word"'
    );
    expect(html).toContain('data-kind="add"');
    expect(html).toContain("--shiki-light:#404040");
  });

  it("falls back to plain Unicode text when syntax tokens do not match", () => {
    const text = "猫 🐈";
    const html = renderToStaticMarkup(
      createElement(WorkspaceCode, {
        syntax: [syntaxToken("猫")],
        text,
        words: [{ kind: "add", text }],
      })
    );

    expect(html).toBe(text);
  });

  it("falls back to plain text when word tokens do not match", () => {
    const text = "const 猫";
    const html = renderToStaticMarkup(
      createElement(WorkspaceCode, {
        syntax: [syntaxToken(text)],
        text,
        words: [{ kind: "add", text: "const" }],
      })
    );

    expect(html).toBe(text);
  });
});

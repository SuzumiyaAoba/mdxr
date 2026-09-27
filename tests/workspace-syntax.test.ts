import { describe, expect, it } from "vitest";

import { highlightMdxSource } from "../src/rehype/shiki.js";
import { parseSyntaxLines } from "../src/workspace-syntax.js";

describe("workspace syntax tokens", () => {
  it("keeps only string Shiki light and dark styles", () => {
    const lines = parseSyntaxLines([
      [
        {
          style: {
            "--shiki-dark": "#e6edf3",
            "--shiki-dark-font-weight": "700",
            "--shiki-dark-text-decoration": 7,
            "--shiki-light": "#24292f",
            "--shiki-light-font-style": "italic",
            "--shiki-light-text-decoration": "underline",
            color: "red",
          },
          text: "heading",
        },
      ],
    ]);

    expect(lines).toStrictEqual([
      [
        {
          style: {
            "--shiki-dark": "#e6edf3",
            "--shiki-dark-font-weight": "700",
            "--shiki-light": "#24292f",
            "--shiki-light-font-style": "italic",
            "--shiki-light-text-decoration": "underline",
          },
          text: "heading",
        },
      ],
    ]);
  });

  it.each([
    null,
    {},
    [null],
    [42],
    [[null]],
    [[{ text: "heading" }]],
    [[{ style: [], text: "heading" }]],
  ])("rejects malformed syntax payloads", (value) => {
    expect(parseSyntaxLines(value)).toBeUndefined();
  });

  it("normalizes CRLF and preserves source text across syntax lines", async () => {
    const source = '# A title\r\n\r\n<Component prop="yes">Text</Component>';
    const lines = await highlightMdxSource(source);
    const flattened = lines.flat();
    const allowedStyles = new Set([
      "--shiki-light",
      "--shiki-dark",
      "--shiki-light-font-style",
      "--shiki-dark-font-style",
      "--shiki-light-font-weight",
      "--shiki-dark-font-weight",
      "--shiki-light-text-decoration",
      "--shiki-dark-text-decoration",
    ]);
    const styleKeysAreAllowed = flattened.every((token) =>
      Object.keys(token.style).every((key) => allowedStyles.has(key))
    );
    const hasThemedToken = flattened.some(
      (token) => typeof token.style["--shiki-light"] === "string"
    );

    expect({
      hasThemedToken,
      joined: lines
        .map((line) => line.map((token) => token.text).join(""))
        .join("\n"),
      styleKeysAreAllowed,
    }).toStrictEqual({
      hasThemedToken: true,
      joined: '# A title\n\n<Component prop="yes">Text</Component>',
      styleKeysAreAllowed: true,
    });
  });

  it("preserves lone carriage returns without treating them as line breaks", async () => {
    const source = "first\rsecond";
    const lines = await highlightMdxSource(source);

    expect(
      lines.map((line) => line.map((token) => token.text).join(""))
    ).toStrictEqual(["first\rsecond"]);
  });
});

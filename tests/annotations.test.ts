import { describe, expect, it } from "vitest";

import {
  annotationsMarkdown,
  findAnnotationSource,
  parseAnnotations,
} from "../src/annotations.js";
import type { AnnotationAnchor, AnnotationSource } from "../src/annotations.js";

const source: AnnotationSource = {
  end: 8,
  file: "/project/plan.mdx",
  heading: "Design",
  image: "",
  label: "",
  start: 7,
  text: "Render rich text and diagrams.",
};

const anchor: AnnotationAnchor = {
  end: 16,
  heading: "Design",
  image: "",
  kind: "text",
  path: [1],
  prefix: "Render ",
  quote: "rich text",
  revision: "v1",
  source,
  start: 7,
  suffix: " and diagrams.",
};

describe("document annotation handoff", () => {
  it("exports source context, multiline quotations, and the original Markdown comment", () => {
    const markdown = annotationsMarkdown(
      { file: "/project/plan.mdx", title: "A <plan>" },
      [
        {
          anchor: { ...anchor, quote: "rich <text>\n**quoted**" },
          comment: "Use **emphasis**.\n\n- Keep the API",
          id: "a",
        },
      ],
      new Set(["a"])
    );
    for (const expected of [
      "# Feedback: A &lt;plan&gt;",
      "Source block: ` /project/plan.mdx:7-8 `",
      "Section: Design",
      "> rich &lt;text&gt;\n> \\*\\*quoted\\*\\*",
      "Use **emphasis**.\n\n- Keep the API",
      "Target no longer found",
    ]) {
      expect(markdown).toContain(expected);
    }
  });

  it("exports figure captions and paths containing backticks safely", () => {
    const markdown = annotationsMarkdown(
      { file: "/project/a`b.mdx", title: "Plan" },
      [
        {
          anchor: {
            ...anchor,
            image: "images/a`b.svg",
            kind: "figure",
            quote: "System diagram",
          },
          comment: "Label the arrows",
          id: "figure",
        },
      ]
    );
    expect(markdown).toContain("Document: `` /project/a`b.mdx ``");
    expect(markdown).toContain("## 1. Figure comment");
    expect(markdown).toContain("Image: `` images/a`b.svg ``");
  });

  it("uses the narrowest source block and refuses ambiguous duplicate text", () => {
    const parent = { ...source, end: 20, start: 1 };
    expect(findAnnotationSource(anchor, [parent, source])).toStrictEqual(
      source
    );
    expect(
      findAnnotationSource(anchor, [source, { ...source, end: 30, start: 29 }])
    ).toBeUndefined();
    expect(
      findAnnotationSource(anchor, [
        source,
        { ...source, end: 30, heading: "Other", start: 29 },
      ])
    ).toStrictEqual(source);
  });

  it("validates persisted records and rejects corrupt versions and anchors", () => {
    const annotation = { anchor, comment: "Make it clearer", id: "a" };
    expect(parseAnnotations(null)).toStrictEqual([]);
    expect(
      parseAnnotations(
        JSON.stringify({ annotations: [annotation], version: 1 })
      )
    ).toStrictEqual([annotation]);
    for (const value of [
      { annotations: [annotation], version: 2 },
      { annotations: [annotation, annotation], version: 1 },
      {
        annotations: [{ ...annotation, anchor: { ...anchor, path: ["body"] } }],
        version: 1,
      },
      {
        annotations: [{ ...annotation, anchor: { ...anchor, start: -1 } }],
        version: 1,
      },
      { annotations: [{ ...annotation, comment: " " }], version: 1 },
    ]) {
      expect(() => parseAnnotations(JSON.stringify(value))).toThrow(
        /Invalid saved annotations|Duplicate annotation identifiers/u
      );
    }
    expect(() => parseAnnotations("not json")).toThrow(SyntaxError);
  });
});

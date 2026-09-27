import { describe, expect, it } from "vitest";

import {
  annotationsMarkdown,
  findAnnotationSource,
  parseAnnotationStore,
  parseAnnotations,
} from "../src/annotations.js";
import type {
  AnnotationAnchor,
  AnnotationBatch,
  AnnotationSource,
  AnnotationStore,
  DocumentAnnotation,
} from "../src/annotations.js";

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

const annotation: DocumentAnnotation = {
  anchor,
  comment: "Make it clearer",
  id: "a",
};

const copyBatch: AnnotationBatch = {
  action: "copy",
  annotations: [annotation],
  createdAt: "2026-09-27T08:00:00.000Z",
  id: "batch-copy",
  markdown: "# Feedback\n",
};

const sendBatch: AnnotationBatch = {
  action: "send",
  annotations: [{ ...annotation, id: "b" }],
  createdAt: "2026-09-27T08:05:00.000Z",
  id: "batch-send",
  markdown: "# Feedback\n\nSent",
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

  it("reads legacy v1 stores without archive history", () => {
    const raw = JSON.stringify({ annotations: [annotation], version: 1 });

    expect(parseAnnotationStore(raw)).toStrictEqual({
      annotations: [annotation],
      history: [],
    });
    expect(parseAnnotations(raw)).toStrictEqual([annotation]);
    expect(parseAnnotationStore(null)).toStrictEqual({
      annotations: [],
      history: [],
    });
  });

  it("round-trips archive batches in oldest-to-newest order", () => {
    const store: AnnotationStore = {
      annotations: [annotation],
      history: [copyBatch, sendBatch],
    };

    expect(
      parseAnnotationStore(JSON.stringify({ version: 1, ...store }))
    ).toStrictEqual(store);
  });

  it.each([
    { annotations: [annotation], history: {}, version: 1 },
    {
      annotations: [annotation],
      history: [{ ...copyBatch, createdAt: "not a date" }],
      version: 1,
    },
    {
      annotations: [annotation],
      history: [copyBatch, { ...sendBatch, id: copyBatch.id }],
      version: 1,
    },
    {
      annotations: [annotation],
      history: [{ ...copyBatch, annotations: [annotation, annotation] }],
      version: 1,
    },
    {
      annotations: [annotation],
      history: [
        {
          ...copyBatch,
          annotations: [
            {
              ...annotation,
              anchor: {
                ...anchor,
                source: { ...source, start: 0 },
              },
            },
          ],
        },
      ],
      version: 1,
    },
  ])("rejects invalid archive history", (value) => {
    expect(() => parseAnnotationStore(JSON.stringify(value))).toThrow(
      /Invalid saved annotation history|Duplicate annotation batch identifiers|Duplicate annotation identifiers in batch/u
    );
  });
});

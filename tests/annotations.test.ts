import { describe, expect, it } from "vitest";

import {
  annotationsMarkdown,
  annotationStatus,
  findAnnotationSource,
  parseAnnotationDocument,
  parseAnnotationStore,
  parseAnnotations,
} from "../src/annotations.js";
import type {
  AnnotationAnchor,
  AnnotationBatch,
  AnnotationResolution,
  AnnotationSource,
  AnnotationStore,
  AnnotationVersion,
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

const version: AnnotationVersion = {
  contentHash: "a".repeat(64),
  createdAt: "2026-09-27T08:00:00.000Z",
  id: "00000000-0000-4000-8000-000000000001",
  sequence: 2,
};

const resolution: AnnotationResolution = {
  resolvedAt: "2026-09-27T08:05:00.000Z",
  revision: "compiled-revision-2",
  version,
};

const resolvedAnnotation: DocumentAnnotation = {
  ...annotation,
  resolution,
  status: "resolved",
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
      "Comment ID: ` a `",
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
        /Invalid saved annotations|Invalid saved annotation history|Duplicate annotation identifiers/u
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

  it("restores the latest archived snapshot for IDs missing from a legacy store", () => {
    const archivedFirst = {
      ...copyBatch,
      annotations: [
        { ...annotation, comment: "Current should take precedence" },
        { ...annotation, comment: "Older archived comment", id: "b" },
      ],
    };
    const archivedLatest = {
      ...sendBatch,
      annotations: [
        { ...annotation, comment: "Latest archived comment", id: "b" },
      ],
    };
    const raw = JSON.stringify({
      annotations: [{ ...annotation, comment: "Unsaved current edit" }],
      history: [archivedFirst, archivedLatest],
      version: 1,
    });
    const migrated = parseAnnotationStore(raw);

    expect(
      migrated.annotations.map(({ comment, id }) => ({ comment, id }))
    ).toStrictEqual([
      { comment: "Unsaved current edit", id: "a" },
      { comment: "Latest archived comment", id: "b" },
    ]);
    expect(migrated.history).toStrictEqual([archivedFirst, archivedLatest]);
    const recovered = migrated.annotations.find(({ id }) => id === "b");
    const latestArchived = migrated.history[1]?.annotations[0];
    if (recovered === undefined || latestArchived === undefined) {
      throw new Error("Expected to recover the archived comment");
    }
    expect(recovered).not.toBe(latestArchived);
    recovered.comment = "Edited after migration";
    expect(latestArchived.comment).toBe("Latest archived comment");
  });

  it("does not restore deleted archived comments from a v2 store", () => {
    const raw = JSON.stringify({
      annotations: [],
      history: [sendBatch],
      version: 2,
    });

    expect(parseAnnotationStore(raw)).toStrictEqual({
      annotations: [],
      history: [sendBatch],
    });
  });

  it("round-trips archive batches in oldest-to-newest order for v2 stores", () => {
    const store: AnnotationStore = {
      annotations: [annotation],
      history: [copyBatch, sendBatch],
    };

    expect(
      parseAnnotationStore(JSON.stringify({ version: 2, ...store }))
    ).toStrictEqual(store);
  });

  it("defaults old comments to open and validates resolved version metadata", () => {
    const parsed = parseAnnotationStore(
      JSON.stringify({
        annotations: [annotation, { ...resolvedAnnotation, id: "resolved" }],
        history: [],
        version: 2,
      })
    );
    expect(parsed.annotations.map(annotationStatus)).toStrictEqual([
      "open",
      "resolved",
    ]);

    const invalidAnnotations = [
      { ...annotation, status: "closed" },
      { ...annotation, resolution },
      { ...resolvedAnnotation, resolution: undefined },
      {
        ...resolvedAnnotation,
        resolution: { ...resolution, revision: "" },
      },
      {
        ...resolvedAnnotation,
        resolution: { ...resolution, resolvedAt: "bad" },
      },
      {
        ...resolvedAnnotation,
        resolution: {
          ...resolution,
          version: { ...version, id: "not-a-version-id" },
        },
      },
      {
        ...resolvedAnnotation,
        resolution: {
          ...resolution,
          version: { ...version, contentHash: "bad" },
        },
      },
      {
        ...resolvedAnnotation,
        resolution: {
          ...resolution,
          version: { ...version, createdAt: "bad" },
        },
      },
      {
        ...resolvedAnnotation,
        resolution: {
          ...resolution,
          version: { ...version, sequence: 0 },
        },
      },
    ];
    for (const invalidAnnotation of invalidAnnotations) {
      expect(() =>
        parseAnnotationStore(
          JSON.stringify({
            annotations: [invalidAnnotation],
            history: [],
            version: 2,
          })
        )
      ).toThrow("Invalid saved annotations");
    }
  });

  it("filters resolved comments from Markdown while retaining open stable IDs", () => {
    const markdown = annotationsMarkdown(
      { file: "/project/plan.mdx", title: "Plan" },
      [annotation, { ...resolvedAnnotation, id: "resolved-id" }]
    );

    expect(markdown).toContain("Comment ID: ` a `");
    expect(markdown).not.toContain("resolved-id");
    expect(markdown.match(/^## /gmu)).toHaveLength(1);
  });

  it("accepts legacy annotation documents and validates optional source hashes", () => {
    const legacyDocument = {
      file: source.file,
      revision: "compiled-revision",
      sources: [source],
      title: "Plan",
    };
    expect(
      parseAnnotationDocument(JSON.stringify(legacyDocument))
    ).toStrictEqual(legacyDocument);
    expect(
      parseAnnotationDocument(
        JSON.stringify({ ...legacyDocument, contentHash: "b".repeat(64) })
      )?.contentHash
    ).toBe("b".repeat(64));
    expect(
      parseAnnotationDocument(
        JSON.stringify({ ...legacyDocument, contentHash: "invalid" })
      )
    ).toBeUndefined();
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

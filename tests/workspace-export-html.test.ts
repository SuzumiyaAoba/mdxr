import { describe, expect, it } from "vitest";

import type {
  AnnotationAnchor,
  DocumentAnnotation,
} from "../src/annotations.js";
import type { WorkspaceBrowserState } from "../src/client/workspace-export-state.js";
import type { WorkspaceExportData } from "../src/workspace-export-data.js";
import { workspaceExportAppendix } from "../src/workspace-export-html.js";

const anchor: AnnotationAnchor = {
  end: 8,
  heading: "Design",
  image: "",
  kind: "text",
  path: [0],
  prefix: "",
  quote: "Review target",
  revision: "original-revision",
  start: 0,
  suffix: "",
};

const versionId = 'version"/<&';
const versionAnchorId =
  "doc-version-00007600006500007200007300006900006f00006e00002200002f00003c000026";
const resolvedComment: DocumentAnnotation = {
  anchor,
  comment: "Resolved safely.",
  id: "comment-1",
  resolution: {
    resolvedAt: "2026-09-30T03:00:00.000Z",
    revision: 'revision <script>alert("x")</script>',
    version: {
      contentHash: "a".repeat(64),
      createdAt: "2026-09-30T02:55:00.000Z",
      id: versionId,
      sequence: 4,
    },
  },
  status: "resolved",
};

const exportedWorkspace: WorkspaceExportData = {
  conversation: null,
  exportedAt: "2026-09-30T03:05:00.000Z",
  file: "/project/review.mdx",
  latestId: versionId,
  versions: [
    {
      contentHash: "a".repeat(64),
      createdAt: "2026-09-30T02:55:00.000Z",
      diff: [],
      id: versionId,
      kind: "change",
      sequence: 4,
      size: 15,
      source: "# Review\n",
    },
  ],
};

const browserState: WorkspaceBrowserState = {
  annotations: {
    annotations: [resolvedComment],
    history: [
      {
        action: "copy",
        annotations: [
          { ...resolvedComment, resolution: undefined, status: "open" },
        ],
        createdAt: "2026-09-30T02:00:00.000Z",
        id: "handoff-1",
        markdown: "# Feedback\n",
      },
    ],
  },
  chatDraft: "",
  detachedAnnotationIds: [],
  fields: [],
  sectionReviews: [],
};

describe("workspace export comment status", () => {
  it("omits chat, drafts and history from review HTML and its JSON payload", () => {
    const workspace: WorkspaceExportData = {
      ...exportedWorkspace,
      conversation: {
        busy: false,
        messages: [{ content: "PRIVATE_CHAT_MARKER", role: "user" }],
        provider: "codex",
      },
      versions: [
        { ...exportedWorkspace.versions[0], source: "PRIVATE_MDX_MARKER" },
      ],
    };
    const browser: WorkspaceBrowserState = {
      ...browserState,
      annotationDraft: { anchor, comment: "PRIVATE_COMMENT_DRAFT" },
      annotations: {
        ...browserState.annotations,
        history: [
          {
            ...browserState.annotations.history[0],
            markdown: "PRIVATE_HANDOFF_MARKER",
          },
        ],
      },
      chatDraft: "PRIVATE_CHAT_DRAFT",
    };
    const html = workspaceExportAppendix(workspace, browser, "review");

    expect(html).toContain("Resolved safely.");
    expect(html).toContain("Document review");
    for (const marker of [
      "PRIVATE_CHAT_MARKER",
      "PRIVATE_MDX_MARKER",
      "PRIVATE_COMMENT_DRAFT",
      "PRIVATE_HANDOFF_MARKER",
      "PRIVATE_CHAT_DRAFT",
      'id="chat"',
      'id="history"',
    ]) {
      expect(html).not.toContain(marker);
    }
    expect(workspace.conversation?.messages[0]?.content).toBe(
      "PRIVATE_CHAT_MARKER"
    );
    expect(browser.chatDraft).toBe("PRIVATE_CHAT_DRAFT");
  });

  it("produces no review payload for document-only exports", () => {
    expect(
      workspaceExportAppendix(exportedWorkspace, browserState, "document")
    ).toBe("");
  });

  it("exports resolution details and links only to the matching saved version", () => {
    const html = workspaceExportAppendix(exportedWorkspace, browserState);

    expect([
      html.includes("<strong>Status:</strong> Resolved"),
      html.includes("2026-09-30T03:00:00.000Z"),
      html.includes("Revision:</strong> revision &lt;script&gt;"),
      html.includes(`<a href="#${versionAnchorId}">Version #4</a>`),
      html.includes(`<article id="${versionAnchorId}">`),
      !html.includes(`href="#${versionId}"`),
      html.includes("<strong>Status:</strong> Open"),
    ]).toStrictEqual([true, true, true, true, true, true, true]);

    const payload =
      /<script type="application\/json" id="doc-export-data">(?<data>[^<]*)<\/script>/u.exec(
        html
      )?.groups?.data;
    if (payload === undefined) {
      throw new Error("Export data is missing from the appendix");
    }
    expect(JSON.parse(payload)).toMatchObject({
      browser: {
        annotations: {
          annotations: [
            {
              resolution: {
                resolvedAt: "2026-09-30T03:00:00.000Z",
                revision: 'revision <script>alert("x")</script>',
                version: { id: versionId, sequence: 4 },
              },
              status: "resolved",
            },
          ],
          history: [{ annotations: [{ status: "open" }] }],
        },
      },
    });
  });

  it("shows a saved version number without linking when its snapshot is absent", () => {
    const { resolution } = resolvedComment;
    if (resolution?.version === undefined) {
      throw new Error("Resolved test comment is missing its version");
    }
    const missingVersionComment: DocumentAnnotation = {
      ...resolvedComment,
      resolution: {
        ...resolution,
        version: {
          ...resolution.version,
          id: "missing-version",
          sequence: 7,
        },
      },
    };
    const html = workspaceExportAppendix(exportedWorkspace, {
      ...browserState,
      annotations: { annotations: [missingVersionComment], history: [] },
    });

    expect(html).toContain("Version #7");
    expect(html).not.toMatch(/<a href="#[^"]+">Version #7<\/a>/u);
  });
});

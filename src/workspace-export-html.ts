import type { DocumentAnnotation } from "./annotations.js";
import type { WorkspaceBrowserState } from "./client/workspace-export-state.js";
import type { WorkspaceExportData } from "./workspace-export-data.js";
import type { WorkspaceExportMode } from "./workspace-export-options.js";

export const escapeExportHtml = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const pre = (text: string): string => `<pre>${escapeExportHtml(text)}</pre>`;
const details = (label: string, content: string): string =>
  `<details><summary>${escapeExportHtml(label)}</summary>${content}</details>`;

const versionAnchorId = (id: string): string =>
  `doc-version-${Array.from(id, (character) =>
    (character.codePointAt(0) ?? 0).toString(16).padStart(6, "0")
  ).join("")}`;

const commentHtml = (
  comment: DocumentAnnotation,
  versionsById: ReadonlyMap<string, WorkspaceExportData["versions"][number]>,
  detached = false
): string => {
  const { anchor } = comment;
  const { source } = anchor;
  const resolved = comment.status === "resolved";
  const resolution = resolved ? comment.resolution : undefined;
  const version = resolution?.version;
  let versionLabel = "";
  if (version !== undefined) {
    versionLabel = `Version #${version.sequence}`;
    if (versionsById.has(version.id)) {
      versionLabel = `<a href="#${versionAnchorId(version.id)}">${versionLabel}</a>`;
    }
  }
  const resolutionHtml =
    resolution === undefined
      ? ""
      : `<p class="doc-export-muted"><strong>Resolved:</strong> ${escapeExportHtml(resolution.resolvedAt)} · <strong>Revision:</strong> ${escapeExportHtml(resolution.revision)}${versionLabel === "" ? "" : ` · ${versionLabel}`}</p>`;
  return `<article><h4>${escapeExportHtml(anchor.heading || anchor.kind)}</h4>
${source === undefined ? "" : `<p class="doc-export-muted">${escapeExportHtml(source.file)}:${source.start}–${source.end}</p>`}
${detached ? "<p>Target no longer found in the current document.</p>" : ""}
<p class="doc-export-muted"><strong>Status:</strong> ${resolved ? "Resolved" : "Open"}</p>${resolutionHtml}
<blockquote>${pre(anchor.quote)}</blockquote>${pre(comment.comment)}
${anchor.image === "" ? "" : `<p>Image: ${escapeExportHtml(anchor.image)}</p>`}</article>`;
};

const commentsHtml = (
  state: WorkspaceBrowserState,
  versionsById: ReadonlyMap<string, WorkspaceExportData["versions"][number]>,
  includeHistory: boolean
): string => {
  const detachedAnnotationIds = new Set(state.detachedAnnotationIds);
  const active = state.annotations.annotations
    .map((comment) =>
      commentHtml(comment, versionsById, detachedAnnotationIds.has(comment.id))
    )
    .join("");
  const history = state.annotations.history
    .map((batch) =>
      details(
        `${batch.createdAt} · ${batch.action} · ${batch.annotations.length} comments`,
        batch.annotations
          .map((comment) => commentHtml(comment, versionsById))
          .join("") + details("Markdown handoff", pre(batch.markdown))
      )
    )
    .join("");
  const draft = state.annotationDraft;
  return `<h3>Current comments</h3>${active || "<p>No current comments.</p>"}
${includeHistory ? `<h3>Comment history</h3>${history || "<p>No comment history.</p>"}` : ""}
${draft === undefined ? "" : `<h3>Unsent comment draft</h3>${commentHtml({ ...draft, id: draft.id ?? "draft" }, versionsById)}`}`;
};

const historyHtml = (data: WorkspaceExportData): string =>
  data.versions
    .map((version, index) => {
      const previous = data.versions[index - 1];
      const diff = version.diff
        .map((line) => {
          const marker = { add: "+", context: " ", remove: "−" }[line.type];
          return `<span class="diff-${line.type}">${marker} ${escapeExportHtml(line.text)}\n</span>`;
        })
        .join("");
      return `<article id="${versionAnchorId(version.id)}"><h4>Version #${version.sequence} · ${escapeExportHtml(version.kind)}</h4>
<p class="doc-export-muted">${escapeExportHtml(version.createdAt)} · ${version.size} bytes</p>
${details("Version metadata", pre(JSON.stringify({ ...version, diff: undefined, source: undefined }, null, 2)))}
${details("MDX source", pre(version.source))}
${previous === undefined ? "<p>Initial version.</p>" : details(`Diff from version ${previous.sequence}`, `<pre class="diff">${diff}</pre>`)}
</article>`;
    })
    .join("");

/* Reuses the document's own CSS variables (--border, --card, --muted-foreground)
 * so the appendix follows the exported theme; .dark variants come from the
 * <html> class the snapshot already carries. */
const APPENDIX_CSS = `
.doc-export{border-top:1px solid var(--border,#e5e5e5);margin-top:3rem;padding-top:2rem}
.doc-export article,.doc-export details{border:1px solid var(--border,#e5e5e5);border-radius:8px;padding:12px 16px;margin:12px 0;background:var(--card,#fff)}
.dark .doc-export article,.dark .doc-export details{background:var(--card,#0a0a0a)}
.doc-export summary{cursor:pointer;font-weight:600}
.doc-export pre{font-size:0.8125rem;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere;margin:0.5rem 0}
.doc-export blockquote{margin:0.5rem 0;padding-left:16px;border-left:3px solid var(--border,#e5e5e5);font-style:normal}
.doc-export p,.doc-export h4{overflow-wrap:anywhere}
.doc-export-muted{color:var(--muted-foreground,#737373)}
.doc-export .diff{white-space:pre-wrap}
.doc-export .diff span{display:block;min-height:1.7em}
.doc-export .diff-add{background:#dcfce7}.dark .doc-export .diff-add{background:#14532d33}
.doc-export .diff-remove{background:#fee2e2}.dark .doc-export .diff-remove{background:#7f1d1d33}
@media print{.doc-export details{break-inside:avoid}}
`;

/**
 * The archive appendix rendered inside the exported document — chat,
 * comments, reviews, and the full version history — plus the machine-readable
 * payload. Exported HTML is a snapshot of the normal rendered page: this
 * markup lands inside #doc-root right after the document body, so everything
 * stays readable in the document's own styles without a wrapper page.
 */
const reviewExport = (
  workspace: WorkspaceExportData,
  browser: WorkspaceBrowserState
): { workspace: WorkspaceExportData; browser: WorkspaceBrowserState } => ({
  browser: {
    ...browser,
    annotationDraft: undefined,
    annotations: {
      annotations: browser.annotations.annotations,
      history: [],
    },
    chatDraft: "",
  },
  workspace: {
    ...workspace,
    conversation: null,
    latestId: "",
    versions: [],
  },
});

const chatHtml = (
  workspace: WorkspaceExportData,
  browser: WorkspaceBrowserState
): string => {
  const { conversation } = workspace;
  const chat =
    conversation?.messages
      .map(
        (message) =>
          `<article><h4>${message.role === "user" ? "User" : "Assistant"}</h4>${pre(message.content)}</article>`
      )
      .join("") ?? "";
  return `<section id="chat"><h3>Chat</h3>${conversation === null ? "" : `<p class="doc-export-muted">${escapeExportHtml(conversation.provider)} · ${escapeExportHtml(conversation.sessionId ?? "No session ID")}</p>${conversation.busy ? "<p>Agent was responding when this archive was exported.</p>" : ""}${conversation.error === undefined ? "" : pre(conversation.error)}`}${chat || "<p>No chat messages.</p>"}${browser.chatDraft === "" ? "" : `<h4>Unsent chat draft</h4>${pre(browser.chatDraft)}`}</section>`;
};

const reviewsHtml = (browser: WorkspaceBrowserState): string =>
  `<section id="reviews"><h3>Reviews and answers</h3>${browser.sectionReviews.map((review) => `<p>${escapeExportHtml(review.title)} — ${review.reviewed ? "Reviewed" : "Not reviewed"}</p>`).join("") || "<p>No section reviews.</p>"}${browser.fields.map((field) => `<article><h4>${escapeExportHtml(field.label)}</h4>${pre(field.value)}</article>`).join("")}</section>`;

export const workspaceExportAppendix = (
  workspace: WorkspaceExportData,
  browser: WorkspaceBrowserState,
  mode: WorkspaceExportMode = "workspace"
): string => {
  if (mode === "document") {
    return "";
  }
  const { workspace: archive, browser: state } =
    mode === "review"
      ? reviewExport(workspace, browser)
      : { browser, workspace };
  const versionsById = new Map(
    archive.versions.map((version) => [version.id, version] as const)
  );
  const json = JSON.stringify({
    browser: state,
    version: 1,
    workspace: archive,
  }).replaceAll("<", "\\u003c");
  return `<div class="doc-export" data-doc-export>
<h2>${mode === "workspace" ? "Workspace archive" : "Document review"}</h2>
<p class="doc-export-muted">Exported ${escapeExportHtml(archive.exportedAt)} · ${escapeExportHtml(archive.file)}</p>
${mode === "workspace" ? chatHtml(archive, state) : ""}
<section id="comments"><h3>Comments</h3>${commentsHtml(state, versionsById, mode === "workspace")}</section>
${reviewsHtml(state)}
${mode === "workspace" ? `<section id="history"><h3>Version history and diffs</h3>${historyHtml(archive)}</section>` : ""}
<script type="application/json" id="doc-export-data">${json}</script>
<style>${APPENDIX_CSS}</style>
</div>`;
};

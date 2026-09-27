import type { DocumentAnnotation } from "./annotations.js";
import type { WorkspaceBrowserState } from "./client/workspace-export-state.js";
import type { WorkspaceExportData } from "./workspace-export-data.js";

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

const commentHtml = (comment: DocumentAnnotation, detached = false): string => {
  const { anchor } = comment;
  const { source } = anchor;
  return `<article><h4>${escapeExportHtml(anchor.heading || anchor.kind)}</h4>
${source === undefined ? "" : `<p>${escapeExportHtml(source.file)}:${source.start}–${source.end}</p>`}
${detached ? "<p>Target no longer found in the current document.</p>" : ""}
<blockquote>${pre(anchor.quote)}</blockquote>${pre(comment.comment)}
${anchor.image === "" ? "" : `<p>Image: ${escapeExportHtml(anchor.image)}</p>`}</article>`;
};

const commentsHtml = (state: WorkspaceBrowserState): string => {
  const active = state.annotations.annotations
    .map((comment) =>
      commentHtml(comment, state.detachedAnnotationIds.includes(comment.id))
    )
    .join("");
  const history = state.annotations.history
    .map((batch) =>
      details(
        `${batch.createdAt} · ${batch.action} · ${batch.annotations.length} comments`,
        batch.annotations.map((comment) => commentHtml(comment)).join("") +
          details("Markdown handoff", pre(batch.markdown))
      )
    )
    .join("");
  const draft = state.annotationDraft;
  return `<h3>Current comments</h3>${active || "<p>No current comments.</p>"}
<h3>Comment history</h3>${history || "<p>No comment history.</p>"}
${draft === undefined ? "" : `<h3>Unsent comment draft</h3>${commentHtml({ ...draft, id: draft.id ?? "draft" })}`}`;
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
      return `<article><h3>Version ${version.sequence} · ${escapeExportHtml(version.kind)}</h3>
<p>${escapeExportHtml(version.createdAt)} · ${version.size} bytes</p>
${details("Version metadata", pre(JSON.stringify({ ...version, diff: undefined, source: undefined }, null, 2)))}
${details("MDX source", pre(version.source))}
${previous === undefined ? "<p>Initial version.</p>" : details(`Diff from version ${previous.sequence}`, `<pre class="diff">${diff}</pre>`)}
</article>`;
    })
    .join("");

const ARCHIVE_CSS = `
:root{color-scheme:light dark;font:16px/1.6 system-ui,sans-serif;background:light-dark(#f8fafc,#111827);color:light-dark(#0f172a,#e2e8f0)}
*{box-sizing:border-box}body{max-width:1000px;margin:auto;padding:24px}h1,h2,h3,h4{line-height:1.3}h2{margin-top:2rem}nav{display:flex;flex-wrap:wrap;gap:16px}a{color:light-dark(#0369a1,#7dd3fc)}section{scroll-margin-top:16px}article,details{border:1px solid light-dark(#cbd5e1,#475569);border-radius:8px;padding:16px;margin:12px 0}summary{cursor:pointer;font-weight:600}pre{font:13px/1.7 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}blockquote{margin:0;padding-left:16px;border-left:3px solid #94a3b8}p{overflow-wrap:anywhere}iframe{width:100%;height:75vh;border:1px solid #94a3b8;border-radius:8px;background:white}.diff span{display:block;min-height:1.7em}.diff{white-space:pre-wrap}.diff-add{background:light-dark(#dcfce7,#14532d)}.diff-remove{background:light-dark(#fee2e2,#7f1d1d)}.muted{color:light-dark(#475569,#cbd5e1)}@media(max-width:600px){body{padding:16px}article,details{padding:12px}}@media print{details{break-inside:avoid}iframe{height:90vh}nav{display:none}}
`;

/** A read-only archive: all data stays readable without JavaScript or a server. */
export const workspaceExportHtml = (
  workspace: WorkspaceExportData,
  browser: WorkspaceBrowserState,
  documentHtml: string,
  title: string
): string => {
  const { conversation } = workspace;
  const chat =
    conversation?.messages
      .map(
        (message) =>
          `<article><h3>${message.role === "user" ? "User" : "Assistant"}</h3>${pre(message.content)}</article>`
      )
      .join("") ?? "";
  const json = JSON.stringify({ browser, version: 1, workspace }).replaceAll(
    "<",
    "\\u003c"
  );
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="mdxr"><title>${escapeExportHtml(title)} — Workspace archive</title><style>${ARCHIVE_CSS}</style></head>
<body><header><h1>${escapeExportHtml(title)}</h1><p class="muted">Workspace archive · ${escapeExportHtml(workspace.exportedAt)}</p><p>${escapeExportHtml(workspace.file)}</p>
<nav aria-label="Archive sections"><a href="#document">Document</a><a href="#chat">Chat</a><a href="#comments">Comments</a><a href="#reviews">Reviews</a><a href="#history">History</a></nav></header>
<main>
<section id="document"><h2>Document</h2><p class="muted">Document as displayed at export time. All captured MDX versions are included below.</p><iframe title="Document snapshot" sandbox="" srcdoc="${escapeExportHtml(documentHtml)}"></iframe></section>
<section id="chat"><h2>Chat</h2>${conversation === null ? "" : `<p>${escapeExportHtml(conversation.provider)} · ${escapeExportHtml(conversation.sessionId ?? "No session ID")}</p>${conversation.busy ? "<p>Agent was responding when this archive was exported.</p>" : ""}${conversation.error === undefined ? "" : pre(conversation.error)}`}${chat || "<p>No chat messages.</p>"}${browser.chatDraft === "" ? "" : `<h3>Unsent chat draft</h3>${pre(browser.chatDraft)}`}</section>
<section id="comments"><h2>Comments</h2>${commentsHtml(browser)}</section>
<section id="reviews"><h2>Reviews and answers</h2>${browser.sectionReviews.map((review) => `<p>${escapeExportHtml(review.title)} — ${review.reviewed ? "Reviewed" : "Not reviewed"}</p>`).join("") || "<p>No section reviews.</p>"}${browser.fields.map((field) => `<article><h3>${escapeExportHtml(field.label)}</h3>${pre(field.value)}</article>`).join("")}</section>
<section id="history"><h2>Version history and diffs</h2>${historyHtml(workspace)}</section>
</main><script type="application/json" id="mdxr-export-data">${json}</script></body></html>`;
};

/** The pinned CSS optimizer does not parse custom highlights yet. Append these
 * native rules after optimization; limiting them to screens keeps print clean. */
export const ANNOTATION_HIGHLIGHT_CSS = `@media screen {
::highlight(mdxr-annotations) { background-color: #facc1559; }
::highlight(mdxr-annotation-active) { background-color: #38bdf859; }
}`;

/** Document chrome lives outside the hydrated MDX tree. All user text is filled via textContent. */
export const annotationHtml = (icon: (name: string) => string): string => `
<div id="mdxr-annotations" class="mdxr-annotations">
  <button type="button" class="mdxr-annotation-toggle" data-annotation-toggle aria-controls="mdxr-annotation-panel" aria-expanded="false">
    ${icon("message-square-text")} <span data-annotation-toggle-label>Annotate</span> <span data-annotation-count>0</span>
  </button>
  <button type="button" class="mdxr-annotation-selection" data-annotation-selection hidden>${icon("message-square-plus")} <span data-annotation-selection-label>Add comment</span></button>
  <aside id="mdxr-annotation-panel" aria-labelledby="mdxr-annotation-title" hidden>
    <header class="mdxr-annotation-header">
      <div class="mdxr-annotation-heading">
        <div class="mdxr-annotation-title-row"><h2 id="mdxr-annotation-title">Annotations</h2><span data-annotation-panel-count>0</span></div>
        <p class="mdxr-annotation-document" data-annotation-document></p>
      </div>
      <button type="button" class="mdxr-annotation-icon-button" data-annotation-pick aria-label="Select figure" title="Select figure" aria-pressed="false">${icon("scan")}</button>
      <button type="button" class="mdxr-annotation-icon-button" data-annotation-close aria-label="Close annotations" title="Close annotations (Esc)">${icon("x")}</button>
    </header>
    <div class="mdxr-annotation-scroll">
      <div class="mdxr-annotation-picker" data-annotation-figure-picker hidden>
        <label class="mdxr-annotation-sr-only" for="mdxr-annotation-figure" data-annotation-figure-label>Figure</label>
        <select id="mdxr-annotation-figure" data-annotation-figure></select>
        <button type="button" class="mdxr-annotation-icon-button" data-annotation-use-figure aria-label="Comment on figure" title="Comment on figure">${icon("arrow-up-right")}</button>
      </div>
      <div class="mdxr-annotation-filter">
        <label class="mdxr-annotation-sr-only" for="mdxr-annotation-filter" data-annotation-filter-label>Filter comments</label>
        <select id="mdxr-annotation-filter" data-annotation-filter aria-label="Filter comments">
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>
      <form class="mdxr-annotation-composer" data-annotation-form aria-label="New comment" hidden>
        <blockquote data-annotation-draft-quote></blockquote>
        <label class="mdxr-annotation-sr-only" for="mdxr-annotation-comment" data-annotation-comment-label>Comment</label>
        <textarea id="mdxr-annotation-comment" data-annotation-comment rows="4" required placeholder="Comment…"></textarea>
        <div class="mdxr-annotation-composer-footer">
          <button type="button" class="mdxr-annotation-icon-button" data-annotation-cancel aria-label="Cancel" title="Cancel">${icon("x")}</button>
          <button type="submit" class="mdxr-annotation-submit" data-annotation-save aria-label="Save comment" title="Save comment (Ctrl / ⌘ + Enter)">${icon("arrow-up")}</button>
        </div>
      </form>
      <p class="mdxr-annotation-empty" data-annotation-empty>No comments</p>
      <ol class="mdxr-annotation-list" data-annotation-list></ol>
      <details class="mdxr-annotation-history" data-annotation-history hidden>
        <summary><span data-annotation-history-label>History</span> <span data-annotation-history-count>0</span></summary>
        <div class="mdxr-annotation-history-list" data-annotation-history-list></div>
      </details>
    </div>
    <footer class="mdxr-annotation-footer">
      <div class="mdxr-annotation-footer-actions">
        <button type="button" data-annotation-copy aria-label="Copy Markdown" title="Copy Markdown" disabled><span class="mdxr-annotation-copy-idle">${icon("copy")}</span><span class="mdxr-annotation-copy-done">${icon("check")}</span><span data-annotation-copy-label>Copy Markdown</span></button>
        <button type="button" data-annotation-send aria-label="Send to chat" title="Send to chat" disabled hidden>${icon("send")}<span data-annotation-send-label>Send to chat</span></button>
      </div>
      <div class="mdxr-annotation-save-status" data-annotation-status-row data-state="saved"><p role="status" aria-live="polite" data-annotation-status></p></div>
      <div data-annotation-export hidden>
        <label class="mdxr-annotation-sr-only" for="mdxr-annotation-markdown" data-annotation-markdown-label>Markdown feedback</label>
        <textarea id="mdxr-annotation-markdown" data-annotation-markdown rows="5" readonly></textarea>
      </div>
    </footer>
  </aside>
  <div class="mdxr-annotation-overlays" data-annotation-overlays aria-hidden="true"></div>
  <div data-annotation-icons hidden>
    <template data-annotation-icon="text">${icon("quote")}</template>
    <template data-annotation-icon="figure">${icon("image")}</template>
    <template data-annotation-icon="go">${icon("arrow-up-right")}</template>
    <template data-annotation-icon="edit">${icon("pencil-line")}</template>
    <template data-annotation-icon="resolve">${icon("circle-check")}</template>
    <template data-annotation-icon="reopen">${icon("rotate-ccw")}</template>
    <template data-annotation-icon="delete">${icon("trash")}</template>
    <template data-annotation-icon="warning">${icon("triangle-alert")}</template>
  </div>
</div>`;

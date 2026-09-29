export interface AnnotationCopy {
  addComment: string;
  cancel: string;
  dateLocale: "en-US" | "ja-JP";
  clipboardFailure: string;
  close: string;
  closeTitle: string;
  commentCount: (count: number) => string;
  commentOnFigure: string;
  commentLabel: string;
  commentPlaceholder: string;
  copiedToHistory: string;
  copiedToHistoryStorageUnavailable: string;
  copyCopied: string;
  copyMarkdown: string;
  delete: string;
  edit: string;
  editConflict: string;
  editComment: string;
  figureKind: string;
  figureLabel: string;
  filterAll: string;
  filterLabel: string;
  filterOpen: string;
  filterResolved: string;
  finishCurrentComment: string;
  history: string;
  historyActionCopy: string;
  historyActionSend: string;
  loadError: string;
  markdownFeedback: string;
  newComment: string;
  noComments: string;
  noCurrentComments: string;
  noFiguresFound: string;
  noOpenComments: string;
  noResolvedComments: string;
  openStatus: string;
  panelTitle: string;
  reopen: string;
  reopenedSaved: string;
  resolve: string;
  resolvedOn: (date: string) => string;
  resolvedSaved: string;
  resolvedStatus: string;
  resolving: string;
  resolutionError: string;
  revisionLabel: (revision: string) => string;
  saveChanges: string;
  saveComment: string;
  saveTitle: (label: string) => string;
  saved: string;
  selectFigure: string;
  sendFailed: (message: string) => string;
  sendFallbackFailed: string;
  sendToChat: string;
  sending: string;
  sentToHistory: string;
  sentToHistoryStorageUnavailable: string;
  showTarget: string;
  sourceLabel: (location: string) => string;
  storageUnavailable: string;
  targetUnavailable: string;
  targetUnavailableTitle: string;
  textSelection: string;
  toggle: string;
  updatedWarning: string;
  viewResolvedVersion: (sequence: number) => string;
  changedWhileResolving: string;
}

const ENGLISH_COPY: AnnotationCopy = {
  addComment: "Add comment",
  cancel: "Cancel",
  changedWhileResolving:
    "The comment changed while checking its version. Please review it again.",
  clipboardFailure:
    "Clipboard access failed. Copy the selected Markdown below.",
  close: "Close annotations",
  closeTitle: "Close annotations (Esc)",
  commentCount: (count) => `${count} ${count === 1 ? "comment" : "comments"}`,
  commentLabel: "Comment",
  commentOnFigure: "Comment on figure",
  commentPlaceholder: "Comment…",
  copiedToHistory: "Copied. Recorded in History.",
  copiedToHistoryStorageUnavailable:
    "Markdown copied. History is available until this page closes; browser storage is unavailable.",
  copyCopied: "Copied",
  copyMarkdown: "Copy Markdown",
  dateLocale: "en-US",
  delete: "Delete",
  edit: "Edit",
  editComment: "Edit comment",
  editConflict:
    "This comment changed in another tab. Copy your draft, then edit it again.",
  figureKind: "Figure",
  figureLabel: "Figure",
  filterAll: "All",
  filterLabel: "Filter comments",
  filterOpen: "Open",
  filterResolved: "Resolved",
  finishCurrentComment: "Finish the current comment first.",
  history: "History",
  historyActionCopy: "Copied Markdown",
  historyActionSend: "Sent to chat",
  loadError:
    "Saved annotations could not be loaded. New comments can still be copied as Markdown.",
  markdownFeedback: "Markdown feedback",
  newComment: "New comment",
  noComments: "No comments",
  noCurrentComments: "No current comments",
  noFiguresFound: "No figures found.",
  noOpenComments: "No open comments",
  noResolvedComments: "No resolved comments",
  openStatus: "Open",
  panelTitle: "Annotations",
  reopen: "Reopen comment",
  reopenedSaved: "Comment reopened.",
  resolutionError:
    "Could not record the resolved version. Reload the document and try again.",
  resolve: "Mark as resolved",
  resolvedOn: (date) => `Resolved ${date}`,
  resolvedSaved: "Comment marked resolved.",
  resolvedStatus: "Resolved",
  resolving: "Checking version…",
  revisionLabel: (revision) => `Recorded revision: ${revision}`,
  saveChanges: "Save changes",
  saveComment: "Save comment",
  saveTitle: (label) => `${label} (Ctrl / ⌘ + Enter)`,
  saved: "Saved in this browser",
  selectFigure: "Select figure",
  sendFailed: (message) => `Could not send annotations: ${message}`,
  sendFallbackFailed: "Could not send annotations to chat.",
  sendToChat: "Send to chat",
  sending: "Sending annotations to chat…",
  sentToHistory: "Sent. Recorded in History.",
  sentToHistoryStorageUnavailable:
    "Annotations sent to chat. History is available until this page closes; browser storage is unavailable.",
  showTarget: "Show target",
  sourceLabel: (location) => `Source: ${location}`,
  storageUnavailable:
    "Browser storage is unavailable. Copy Markdown before closing this page to keep your comments.",
  targetUnavailable: "Target unavailable",
  targetUnavailableTitle:
    "The target changed or was removed. The original quote is preserved.",
  textSelection: "Text selection",
  toggle: "Annotate",
  updatedWarning:
    "The document has changed. Review this comment again before considering it resolved.",
  viewResolvedVersion: (sequence) => `View corrected version · #${sequence}`,
};

const JAPANESE_COPY: AnnotationCopy = {
  addComment: "コメントを追加",
  cancel: "キャンセル",
  changedWhileResolving:
    "確認中にコメントが変更されました。もう一度確認してください。",
  clipboardFailure:
    "クリップボードを利用できません。下の Markdown をコピーしてください。",
  close: "コメントを閉じる",
  closeTitle: "コメントを閉じる（Esc）",
  commentCount: (count) => `${count}件のコメント`,
  commentLabel: "コメント",
  commentOnFigure: "図にコメント",
  commentPlaceholder: "コメント…",
  copiedToHistory: "コピーしました。履歴に記録しました。",
  copiedToHistoryStorageUnavailable:
    "Markdown をコピーしました。履歴はページを閉じるまで利用できますが、ブラウザーのストレージを利用できません。",
  copyCopied: "コピー済み",
  copyMarkdown: "Markdown をコピー",
  dateLocale: "ja-JP",
  delete: "削除",
  edit: "編集",
  editComment: "コメントを編集",
  editConflict:
    "別のタブでこのコメントが変更されました。下書きをコピーしてから編集し直してください。",
  figureKind: "図",
  figureLabel: "図",
  filterAll: "すべて",
  filterLabel: "コメントを絞り込む",
  filterOpen: "未対応",
  filterResolved: "対応済み",
  finishCurrentComment: "現在のコメントを先に完了してください。",
  history: "履歴",
  historyActionCopy: "Markdown をコピー",
  historyActionSend: "チャットへ送信",
  loadError:
    "保存したコメントを読み込めませんでした。新しいコメントは Markdown としてコピーできます。",
  markdownFeedback: "Markdown フィードバック",
  newComment: "新しいコメント",
  noComments: "コメントはありません",
  noCurrentComments: "現在のコメントはありません",
  noFiguresFound: "図が見つかりません。",
  noOpenComments: "未対応のコメントはありません",
  noResolvedComments: "対応済みのコメントはありません",
  openStatus: "未対応",
  panelTitle: "コメント",
  reopen: "未対応に戻す",
  reopenedSaved: "未対応に戻しました。",
  resolutionError:
    "対応版を記録できませんでした。文書を再読み込みしてお試しください。",
  resolve: "対応済みにする",
  resolvedOn: (date) => `${date}に対応済み`,
  resolvedSaved: "対応済みにしました。",
  resolvedStatus: "対応済み",
  resolving: "対応版を確認中…",
  revisionLabel: (revision) => `記録したリビジョン: ${revision}`,
  saveChanges: "変更を保存",
  saveComment: "コメントを保存",
  saveTitle: (label) => `${label}（Ctrl / ⌘ + Enter）`,
  saved: "このブラウザーに保存しました",
  selectFigure: "図を選択",
  sendFailed: (message) => `注釈を送信できませんでした: ${message}`,
  sendFallbackFailed: "注釈をチャットに送信できませんでした。",
  sendToChat: "チャットへ送信",
  sending: "コメントをチャットに送信しています…",
  sentToHistory: "送信しました。履歴に記録しました。",
  sentToHistoryStorageUnavailable:
    "コメントをチャットに送信しました。履歴はページを閉じるまで利用できますが、ブラウザーのストレージを利用できません。",
  showTarget: "対象箇所を表示",
  sourceLabel: (location) => `ソース: ${location}`,
  storageUnavailable:
    "ブラウザーのストレージを利用できません。コメントを残すにはページを閉じる前に Markdown をコピーしてください。",
  targetUnavailable: "対象を表示できません",
  targetUnavailableTitle:
    "対象が変更または削除されています。元の引用は保持されています。",
  textSelection: "テキスト選択",
  toggle: "コメント",
  updatedWarning: "文書が更新されています。対応内容を再確認してください。",
  viewResolvedVersion: (sequence) => `修正版を見る · #${sequence}`,
};

export const getAnnotationCopy = (): AnnotationCopy =>
  typeof navigator !== "undefined" &&
  navigator.language.toLowerCase().startsWith("ja")
    ? JAPANESE_COPY
    : ENGLISH_COPY;

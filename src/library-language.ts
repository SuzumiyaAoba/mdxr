import { useEffect, useState } from "react";

import { readDocumentStorage } from "./client/storage.js";

export type LibraryLanguage = "ja" | "en";
export type LibraryCopy = (typeof labels)["en"] | (typeof labels)["ja"];

const LANGUAGE_STORAGE_KEY = "doc:library:language";

const labels = {
  en: {
    allStatuses: "All statuses",
    cancel: "Cancel",
    delete: "Delete",
    deleteDescription: "This document file will be permanently deleted.",
    deleteError: "Could not delete the document. Please try again.",
    deleteLabel: (title: string) => `Delete ${title}`,
    deleteTitle: "Delete document",
    deleting: "Deleting…",
    documents: "Documents",
    emptyLibrary: "This library has no Markdown or MDX documents yet.",
    emptySearch: "No documents match this search.",
    error: "Could not load the document library. Try refreshing.",
    languageButton: "日本語",
    languageLabel: "Switch language to Japanese",
    loading: "Loading documents…",
    noStatus: "No status",
    openNewTab: "Opens in a new tab",
    refresh: "Refresh list",
    refreshing: "Refreshing…",
    resultCount: (matched: string, total: string) =>
      `${matched} of ${total} documents`,
    search: "Search documents",
    searchHint:
      "Separate words with spaces to find documents containing all of them.",
    searchPlaceholder: "Search titles, paths, and contents",
    sort: "Sort by",
    sortRelevance: "Relevance",
    sortTitle: "Title",
    sortUpdated: "Recently updated",
    staleError: "Showing the last successful results.",
    status: "Status",
    themeAuto: "System",
    themeDark: "Dark",
    themeLabel: (mode: string) => `Switch theme (current: ${mode})`,
    themeLight: "Light",
    title: "Document library",
    updated: "Updated",
    warning: (count: string) =>
      `${count} document${count === "1" ? "" : "s"} could not be loaded cleanly.`,
    warningParse: "Could not parse normally",
    warningRead: "Could not read",
  },
  ja: {
    allStatuses: "すべての状態",
    cancel: "キャンセル",
    delete: "削除",
    deleteDescription: "この文書ファイルは完全に削除されます。",
    deleteError: "文書を削除できませんでした。もう一度お試しください。",
    deleteLabel: (title: string) => `${title}を削除`,
    deleteTitle: "文書を削除",
    deleting: "削除中…",
    documents: "文書",
    emptyLibrary: "このライブラリには Markdown・MDX 文書がありません。",
    emptySearch: "条件に一致する文書がありません。",
    error: "文書ライブラリを読み込めませんでした。再読み込みしてください。",
    languageButton: "English",
    languageLabel: "英語に切り替え",
    loading: "文書を読み込み中…",
    noStatus: "状態なし",
    openNewTab: "新しいタブで開きます",
    refresh: "一覧を更新",
    refreshing: "更新中…",
    resultCount: (matched: string, total: string) =>
      `${matched} / ${total} 件の文書`,
    search: "文書を検索",
    searchHint: "空白で区切ると、すべての語を含む文書を検索します。",
    searchPlaceholder: "タイトル・パス・本文を検索",
    sort: "並べ替え",
    sortRelevance: "関連度順",
    sortTitle: "タイトル順",
    sortUpdated: "更新日順",
    staleError: "前回読み込めた結果を表示しています。",
    status: "状態",
    themeAuto: "自動",
    themeDark: "ダーク",
    themeLabel: (mode: string) => `テーマを切り替え（現在：${mode}）`,
    themeLight: "ライト",
    title: "文書ライブラリ",
    updated: "更新",
    warning: (count: string) =>
      `${count} 件の文書を正常に読み込めませんでした。`,
    warningParse: "形式を正常に解析できません",
    warningRead: "読み込めません",
  },
} as const;

const statusLabels: Record<string, { en: string; ja: string }> = {
  blocked: { en: "Blocked", ja: "ブロック中" },
  doing: { en: "In progress", ja: "対応中" },
  done: { en: "Done", ja: "完了" },
  todo: { en: "To do", ja: "未着手" },
};

const dateFormatters: Record<LibraryLanguage, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }),
  ja: new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }),
};

const countFormatters: Record<LibraryLanguage, Intl.NumberFormat> = {
  en: new Intl.NumberFormat("en-US"),
  ja: new Intl.NumberFormat("ja-JP"),
};

const initialLanguage = (): LibraryLanguage => {
  try {
    const stored = readDocumentStorage(
      window.localStorage,
      LANGUAGE_STORAGE_KEY
    );
    if (stored === "ja" || stored === "en") {
      return stored;
    }
  } catch {
    // The browser can still choose a language when storage is unavailable.
  }
  return navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
};

export const formatDate = (
  value: string,
  language: LibraryLanguage
): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return language === "ja" ? "日時不明" : "Date unavailable";
  }
  return dateFormatters[language].format(date);
};

export const formatCount = (value: number, language: LibraryLanguage): string =>
  countFormatters[language].format(value);

export const displayStatus = (
  status: string,
  language: LibraryLanguage
): string => {
  if (status === "") {
    return labels[language].noStatus;
  }
  return statusLabels[status]?.[language] ?? status;
};

interface LibraryLanguageState {
  copy: LibraryCopy;
  language: LibraryLanguage;
  toggleLanguage: () => void;
}

export const useLibraryLanguage = (): LibraryLanguageState => {
  const [language, setLanguage] = useState<LibraryLanguage>(initialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === "ja" ? "文書ライブラリ" : "Document library";
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Language switching remains available for the current page.
    }
  }, [language]);

  return {
    copy: labels[language],
    language,
    toggleLanguage: () => {
      setLanguage((current) => (current === "ja" ? "en" : "ja"));
    },
  };
};

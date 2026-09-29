import {
  ArrowUpRight,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileSearch,
  FileText,
  Languages,
  Moon,
  RefreshCw,
  Search,
  Sun,
  SunMoon,
  Trash2,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { LibraryDeleteDialog } from "./library-delete.js";
import { useLibrarySearch } from "./library-state.js";
import { useLibraryTheme } from "./library-theme.js";
import type {
  LibraryMatch,
  LibraryResult,
  LibrarySort,
  LibraryWarning,
} from "./library-types.js";
import { TONE } from "./ui/tones.js";

type LibraryLanguage = "ja" | "en";
type LibraryCopy = (typeof labels)["en"] | (typeof labels)["ja"];
type SortLabel = "sortRelevance" | "sortUpdated" | "sortTitle";

const LANGUAGE_STORAGE_KEY = "mdxr:library:language";

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

const statusTones: Record<string, string> = {
  blocked: TONE.red,
  doing: TONE.sky,
  done: TONE.emerald,
  todo: TONE.neutral,
};

const sortOptions: {
  id: LibrarySort;
  label: SortLabel;
}[] = [
  { id: "relevance", label: "sortRelevance" },
  { id: "updated", label: "sortUpdated" },
  { id: "title", label: "sortTitle" },
];

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
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "ja" || stored === "en") {
      return stored;
    }
  } catch {
    // The browser can still choose a language when storage is unavailable.
  }
  return navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
};

const formatDate = (value: string, language: LibraryLanguage): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return language === "ja" ? "日時不明" : "Date unavailable";
  }
  return dateFormatters[language].format(date);
};

const formatCount = (value: number, language: LibraryLanguage): string =>
  countFormatters[language].format(value);

const displayStatus = (status: string, language: LibraryLanguage): string => {
  if (status === "") {
    return labels[language].noStatus;
  }
  return statusLabels[status]?.[language] ?? status;
};

const highlight = (
  text: string,
  ranges: readonly LibraryMatch[]
): ReactNode => {
  if (ranges.length === 0 || text === "") {
    return text;
  }

  const orderedRanges = ranges.toSorted(
    (left, right) => left.start - right.start || left.end - right.end
  );
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (const range of orderedRanges) {
    const start = Math.max(cursor, Math.max(0, range.start));
    const end = Math.min(text.length, range.end);
    if (end <= start) {
      continue;
    }
    if (start > cursor) {
      parts.push(
        <Fragment key={`text-${cursor}-${start}`}>
          {text.slice(cursor, start)}
        </Fragment>
      );
    }
    parts.push(
      <mark key={`match-${start}-${end}`}>{text.slice(start, end)}</mark>
    );
    cursor = end;
    if (cursor === text.length) {
      break;
    }
  }

  if (cursor < text.length) {
    parts.push(<Fragment key="text-tail">{text.slice(cursor)}</Fragment>);
  }
  return parts.length === 0 ? text : parts;
};

const documentHref = (document: LibraryResult): string =>
  `/__mdxr_library/open/${encodeURIComponent(document.id)}`;

const LibraryControls = ({
  copy,
  handleLanguageChange,
}: {
  copy: LibraryCopy;
  handleLanguageChange: () => void;
}) => {
  const { mode, cycle } = useLibraryTheme();
  const themeLabels = {
    auto: copy.themeAuto,
    dark: copy.themeDark,
    light: copy.themeLight,
  };
  return (
    <div className="mdxr-library__controls">
      <button
        aria-label={copy.languageLabel}
        className="mdxr-library__language"
        onClick={handleLanguageChange}
        type="button"
      >
        <Languages aria-hidden="true" size={15} />
        <span>{copy.languageButton}</span>
      </button>
      <button
        aria-label={copy.themeLabel(themeLabels[mode])}
        className="mdxr-library__theme"
        data-mdxr-theme=""
        data-mdxr-theme-react=""
        data-mode={mode}
        onClick={cycle}
        title={copy.themeLabel(themeLabels[mode])}
        type="button"
      >
        {mode === "auto" && <SunMoon aria-hidden="true" size={16} />}
        {mode === "light" && <Sun aria-hidden="true" size={16} />}
        {mode === "dark" && <Moon aria-hidden="true" size={16} />}
      </button>
    </div>
  );
};

interface LibraryToolbarProps {
  copy: LibraryCopy;
  handleCompositionEnd: (value: string) => void;
  handleCompositionStart: () => void;
  handleInput: (value: string) => void;
  handleRefresh: () => void;
  handleSort: (sort: LibrarySort) => void;
  handleStatus: (status: string) => void;
  language: LibraryLanguage;
  loading: boolean;
  sort: LibrarySort;
  status: string;
  statuses: string[];
}

const isLibrarySort = (value: string): value is LibrarySort =>
  value === "relevance" || value === "updated" || value === "title";

const LibraryToolbar = ({
  copy,
  handleCompositionEnd,
  handleCompositionStart,
  handleInput,
  handleRefresh,
  handleSort,
  handleStatus,
  language,
  loading,
  sort,
  status,
  statuses,
}: LibraryToolbarProps) => (
  <section aria-label={copy.search} className="mdxr-library__toolbar">
    <label className="mdxr-library__search">
      <span className="mdxr-library__sr-only">{copy.search}</span>
      <span className="mdxr-library__search-field">
        <Search aria-hidden="true" size={18} />
        <input
          aria-label={copy.search}
          aria-describedby="mdxr-library-search-hint"
          autoComplete="off"
          onCompositionEnd={(event) => {
            handleCompositionEnd(event.currentTarget.value);
          }}
          onCompositionStart={handleCompositionStart}
          onInput={(event) => {
            handleInput(event.currentTarget.value);
          }}
          placeholder={copy.searchPlaceholder}
          type="search"
        />
      </span>
    </label>
    <p className="mdxr-library__sr-only" id="mdxr-library-search-hint">
      {copy.searchHint}
    </p>
    <div className="mdxr-library__filters">
      <label className="mdxr-library__filter">
        <span className="mdxr-library__control-label">{copy.status}</span>
        <span className="mdxr-library__select">
          <select
            aria-label={copy.status}
            onChange={(event) => {
              handleStatus(event.currentTarget.value);
            }}
            value={status}
          >
            <option value="">{copy.allStatuses}</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {displayStatus(item, language)}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" size={13} />
        </span>
      </label>

      <label className="mdxr-library__filter">
        <span className="mdxr-library__control-label">{copy.sort}</span>
        <span className="mdxr-library__select">
          <select
            aria-label={copy.sort}
            onChange={(event) => {
              const { value } = event.currentTarget;
              if (isLibrarySort(value)) {
                handleSort(value);
              }
            }}
            value={sort}
          >
            {sortOptions.map(({ id, label }) => (
              <option key={id} value={id}>
                {copy[label]}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" size={13} />
        </span>
      </label>

      <button
        aria-label={loading ? copy.refreshing : copy.refresh}
        className="mdxr-library__refresh"
        disabled={loading}
        onClick={handleRefresh}
        type="button"
      >
        <RefreshCw
          aria-hidden="true"
          className={loading ? "mdxr-library__refresh-icon--spinning" : ""}
          size={17}
        />
        <span>{loading ? copy.refreshing : copy.refresh}</span>
      </button>
    </div>
  </section>
);

const LibraryWarningList = ({
  copy,
  language,
  warnings,
}: {
  copy: LibraryCopy;
  language: LibraryLanguage;
  warnings: LibraryWarning[];
}) => (
  <details className="mdxr-library__warnings">
    <summary>
      <CircleAlert aria-hidden="true" size={15} />
      <span>{copy.warning(formatCount(warnings.length, language))}</span>
      <ChevronDown
        aria-hidden="true"
        className="mdxr-library__warning-chevron"
        size={14}
      />
    </summary>
    <ul>
      {warnings.map((warning) => (
        <li key={`${warning.path}:${warning.reason}`}>
          <span>{warning.path}</span>
          <span>
            {warning.reason === "parse" ? copy.warningParse : copy.warningRead}
          </span>
        </li>
      ))}
    </ul>
  </details>
);

const LibraryDocumentCard = ({
  copy,
  document,
  handleDelete,
  language,
}: {
  copy: LibraryCopy;
  document: LibraryResult;
  handleDelete: (document: LibraryResult) => void;
  language: LibraryLanguage;
}) => (
  <article className="mdxr-library__card">
    <div aria-hidden="true" className="mdxr-library__file-icon">
      <FileText size={19} strokeWidth={1.5} />
    </div>
    <div className="mdxr-library__document">
      <div className="mdxr-library__document-heading">
        <h2>
          <a
            href={documentHref(document)}
            rel="noopener noreferrer"
            target="_blank"
          >
            {highlight(document.title || document.path, document.titleMatches)}
            <span className="mdxr-library__sr-only">{` (${copy.openNewTab})`}</span>
            <ArrowUpRight
              aria-hidden="true"
              className="mdxr-library__external"
              size={15}
            />
          </a>
        </h2>
        {document.status !== "" && (
          <span
            className={`mdxr-library__status ${statusTones[document.status] ?? TONE.neutral}`}
            data-status={document.status}
          >
            {displayStatus(document.status, language)}
          </span>
        )}
      </div>
      {document.excerpt !== "" && (
        <p className="mdxr-library__excerpt">
          {highlight(document.excerpt, document.excerptMatches)}
        </p>
      )}
      <div className="mdxr-library__document-meta">
        <p className="mdxr-library__path" title={document.path}>
          {document.path}
        </p>
        <time
          dateTime={document.updatedAt}
          title={`${copy.updated} ${formatDate(document.updatedAt, language)}`}
        >
          <Clock3 aria-hidden="true" size={12} />
          <span className="mdxr-library__sr-only">{copy.updated} </span>
          {formatDate(document.updatedAt, language)}
        </time>
      </div>
    </div>
    <button
      aria-label={copy.deleteLabel(document.title)}
      className="mdxr-library__delete"
      onClick={() => {
        handleDelete(document);
      }}
      title={copy.deleteLabel(document.title)}
      type="button"
    >
      <Trash2 aria-hidden="true" size={16} strokeWidth={1.5} />
    </button>
  </article>
);

const LibraryResults = ({
  copy,
  data,
  error,
  handleDelete,
  handleRefresh,
  language,
  loading,
}: {
  copy: LibraryCopy;
  data: ReturnType<typeof useLibrarySearch>["data"];
  error: boolean;
  handleDelete: (document: LibraryResult) => void;
  handleRefresh: () => void;
  language: LibraryLanguage;
  loading: boolean;
}) => (
  <section
    aria-busy={loading}
    aria-label={copy.title}
    className="mdxr-library__results"
  >
    <div className="mdxr-library__results-heading">
      <h2>{copy.documents}</h2>
      <output aria-live="polite" className="mdxr-library__count">
        {data === undefined
          ? copy.loading
          : copy.resultCount(
              formatCount(data.matched, language),
              formatCount(data.total, language)
            )}
      </output>
      {loading && (
        <output className="mdxr-library__loading">{copy.loading}</output>
      )}
    </div>

    {error && (
      <div className="mdxr-library__error" role="alert">
        <p>{copy.error}</p>
        {data !== undefined && <p>{copy.staleError}</p>}
        <button onClick={handleRefresh} type="button">
          {copy.refresh}
        </button>
      </div>
    )}

    {data !== undefined && data.warnings.length > 0 && (
      <LibraryWarningList
        copy={copy}
        language={language}
        warnings={data.warnings}
      />
    )}

    {data !== undefined && data.results.length > 0 && (
      <ul className="mdxr-library__list">
        {data.results.map((document) => (
          <li key={document.id}>
            <LibraryDocumentCard
              copy={copy}
              document={document}
              handleDelete={handleDelete}
              language={language}
            />
          </li>
        ))}
      </ul>
    )}

    {data !== undefined && data.results.length === 0 && (
      <div className="mdxr-library__empty">
        <FileSearch aria-hidden="true" size={28} strokeWidth={1.25} />
        <output>
          {data.total === 0 ? copy.emptyLibrary : copy.emptySearch}
        </output>
        {data.total === 0 && <p>{data.root}</p>}
      </div>
    )}
  </section>
);

const LibraryApp = () => {
  const [language, setLanguage] = useState<LibraryLanguage>(initialLanguage);
  const [deleteTarget, setDeleteTarget] = useState<LibraryResult | null>(null);
  const state = useLibrarySearch();
  const copy = labels[language];

  useEffect(() => {
    document.documentElement.lang = language;
    document.title =
      language === "ja" ? "mdxr · 文書ライブラリ" : "mdxr · Document library";
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Language switching remains available for the current page.
    }
  }, [language]);

  return (
    <>
      <LibraryControls
        copy={copy}
        handleLanguageChange={() => {
          setLanguage(language === "ja" ? "en" : "ja");
        }}
      />
      <main aria-label={copy.title} className="mdxr-library">
        <div className="mdxr-library__shell">
          <LibraryToolbar
            copy={copy}
            handleCompositionEnd={state.onCompositionEnd}
            handleCompositionStart={state.onCompositionStart}
            handleInput={state.onInput}
            handleRefresh={state.refresh}
            handleSort={state.setSort}
            handleStatus={state.setStatus}
            language={language}
            loading={state.loading}
            sort={state.sort}
            status={state.status}
            statuses={state.data?.statuses ?? []}
          />
          <LibraryResults
            copy={copy}
            data={state.data}
            error={state.error}
            handleDelete={setDeleteTarget}
            handleRefresh={state.refresh}
            language={language}
            loading={state.loading}
          />
        </div>
      </main>
      {deleteTarget !== null && (
        <LibraryDeleteDialog
          copy={copy}
          document={deleteTarget}
          handleCancel={() => {
            setDeleteTarget(null);
          }}
          handleDeleted={(id) => {
            state.removeDocument(id);
            setDeleteTarget(null);
          }}
          key={deleteTarget.id}
        />
      )}
    </>
  );
};

const root = document.querySelector<HTMLElement>("#mdxr-library-root");
if (root !== null) {
  createRoot(root).render(<LibraryApp />);
}

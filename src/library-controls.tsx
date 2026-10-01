import {
  ChevronDown,
  Languages,
  Moon,
  RefreshCw,
  Search,
  Sun,
  SunMoon,
} from "lucide-react";

import { displayStatus } from "./library-language.js";
import type { LibraryCopy, LibraryLanguage } from "./library-language.js";
import { useLibraryTheme } from "./library-theme.js";
import type { LibrarySort } from "./library-types.js";

type SortLabel = "sortRelevance" | "sortUpdated" | "sortTitle";

const sortOptions: {
  id: LibrarySort;
  label: SortLabel;
}[] = [
  { id: "relevance", label: "sortRelevance" },
  { id: "updated", label: "sortUpdated" },
  { id: "title", label: "sortTitle" },
];

export const LibraryControls = ({
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

export const LibraryToolbar = ({
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

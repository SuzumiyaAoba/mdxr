import {
  ArrowUpRight,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileSearch,
  FileText,
  Trash2,
} from "lucide-react";
import { Fragment } from "react";
import type { ReactNode } from "react";

import { displayStatus, formatCount, formatDate } from "./library-language.js";
import type { LibraryCopy, LibraryLanguage } from "./library-language.js";
import type {
  LibraryMatch,
  LibraryResult,
  LibrarySearchResponse,
  LibraryWarning,
} from "./library-types.js";
import { TONE } from "./ui/tones.js";

const statusTones: Record<string, string> = {
  blocked: TONE.red,
  doing: TONE.sky,
  done: TONE.emerald,
  todo: TONE.neutral,
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

export const LibraryResults = ({
  copy,
  data,
  error,
  handleDelete,
  handleRefresh,
  language,
  loading,
}: {
  copy: LibraryCopy;
  data: LibrarySearchResponse | undefined;
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

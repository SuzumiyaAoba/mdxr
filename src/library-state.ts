import { useCallback, useEffect, useRef, useState } from "react";

import type {
  LibraryMatch,
  LibraryResult,
  LibrarySearchResponse,
  LibrarySort,
  LibraryWarning,
} from "./library-types.js";

const SEARCH_DEBOUNCE_MS = 220;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isHighlightRange = (value: unknown): value is LibraryMatch =>
  isRecord(value) &&
  typeof value.start === "number" &&
  Number.isInteger(value.start) &&
  typeof value.end === "number" &&
  Number.isInteger(value.end);

const isHighlightRanges = (value: unknown): value is LibraryMatch[] =>
  Array.isArray(value) && value.every(isHighlightRange);

const isLibraryResult = (value: unknown): value is LibraryResult =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.path === "string" &&
  typeof value.title === "string" &&
  typeof value.status === "string" &&
  typeof value.updatedAt === "string" &&
  typeof value.excerpt === "string" &&
  isHighlightRanges(value.titleMatches) &&
  isHighlightRanges(value.excerptMatches);

const isLibraryWarning = (value: unknown): value is LibraryWarning =>
  isRecord(value) &&
  typeof value.path === "string" &&
  (value.reason === "read" || value.reason === "parse");

const isLibrarySearchResponse = (
  value: unknown
): value is LibrarySearchResponse =>
  isRecord(value) &&
  typeof value.root === "string" &&
  Array.isArray(value.results) &&
  value.results.every(isLibraryResult) &&
  typeof value.total === "number" &&
  Number.isInteger(value.total) &&
  typeof value.matched === "number" &&
  Number.isInteger(value.matched) &&
  isStringArray(value.statuses) &&
  Array.isArray(value.warnings) &&
  value.warnings.every(isLibraryWarning);

const loadLibrarySearch = async (
  url: string,
  signal: AbortSignal
): Promise<LibrarySearchResponse> => {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error("Library search failed");
  }
  const payload: unknown = await response.json();
  if (!isLibrarySearchResponse(payload)) {
    throw new Error("Library search returned invalid data");
  }
  return payload;
};

const performLibrarySearch = async (
  url: string,
  signal: AbortSignal,
  onSuccess: (payload: LibrarySearchResponse) => void,
  onFailure: () => void
): Promise<void> => {
  try {
    const payload = await loadLibrarySearch(url, signal);
    if (!signal.aborted) {
      onSuccess(payload);
    }
  } catch {
    if (!signal.aborted) {
      onFailure();
    }
  }
};

const noEffectCleanup = (): void => undefined;

export interface LibrarySearchState {
  data: LibrarySearchResponse | undefined;
  error: boolean;
  loading: boolean;
  onCompositionEnd: (value: string) => void;
  onCompositionStart: () => void;
  onInput: (value: string) => void;
  refresh: () => void;
  removeDocument: (id: string) => void;
  setSort: (sort: LibrarySort) => void;
  setStatus: (status: string) => void;
  sort: LibrarySort;
  status: string;
}

export const useLibrarySearch = (): LibrarySearchState => {
  const [searchRequest, setSearchRequest] = useState({
    query: "",
    revision: 0,
  });
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<LibrarySort>("relevance");
  const [data, setData] = useState<LibrarySearchResponse | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const composing = useRef(false);
  const compositionCommitPending = useRef(false);
  const debounceTimer = useRef<number | null>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const lastFocusRefresh = useRef<number | null>(null);

  const scheduleSearch = useCallback((value: string): void => {
    if (debounceTimer.current !== null) {
      window.clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = window.setTimeout(() => {
      const query = value.trim();
      const refreshForComposition = compositionCommitPending.current;
      compositionCommitPending.current = false;
      setSearchRequest((current) => {
        if (current.query === query && !refreshForComposition) {
          return current;
        }
        return {
          query,
          revision: current.revision + (refreshForComposition ? 1 : 0),
        };
      });
      debounceTimer.current = null;
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const onCompositionStart = useCallback((): void => {
    composing.current = true;
    compositionCommitPending.current = true;
    if (debounceTimer.current !== null) {
      window.clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    activeRequest.current?.abort();
  }, []);

  const onCompositionEnd = useCallback(
    (value: string): void => {
      composing.current = false;
      scheduleSearch(value);
    },
    [scheduleSearch]
  );

  const onInput = useCallback(
    (value: string): void => {
      if (!composing.current) {
        scheduleSearch(value);
      }
    },
    [scheduleSearch]
  );

  const refresh = useCallback((): void => {
    setSearchRequest((current) => ({
      ...current,
      revision: current.revision + 1,
    }));
  }, []);

  const removeDocument = useCallback(
    (id: string): void => {
      // An older search must not put a successfully deleted document back.
      activeRequest.current?.abort();
      setData((current) => {
        if (current === undefined) {
          return current;
        }
        const results = current.results.filter((result) => result.id !== id);
        const removed = current.results.length - results.length;
        return {
          ...current,
          matched: Math.max(0, current.matched - removed),
          results,
          total: Math.max(0, current.total - removed),
        };
      });
      refresh();
    },
    [refresh]
  );

  useEffect(() => {
    const onWindowFocus = (): void => {
      const focusedAt = Date.now();
      if (
        composing.current ||
        (lastFocusRefresh.current !== null &&
          focusedAt - lastFocusRefresh.current < 5000)
      ) {
        return;
      }
      lastFocusRefresh.current = focusedAt;
      refresh();
    };
    lastFocusRefresh.current = Date.now();
    window.addEventListener("focus", onWindowFocus);
    return () => {
      window.removeEventListener("focus", onWindowFocus);
    };
  }, [refresh]);

  useEffect(
    () => () => {
      if (debounceTimer.current !== null) {
        window.clearTimeout(debounceTimer.current);
      }
    },
    []
  );

  useEffect(() => {
    if (composing.current) {
      return noEffectCleanup;
    }

    const controller = new AbortController();
    activeRequest.current = controller;
    const parameters = new URLSearchParams({ q: searchRequest.query, sort });
    if (status !== "") {
      parameters.set("status", status);
    }

    setLoading(true);
    setError(false);
    const searchUrl = `/__mdxr_library/search?${parameters.toString()}`;
    void performLibrarySearch(
      searchUrl,
      controller.signal,
      (payload) => {
        setData(payload);
        setLoading(false);
      },
      () => {
        setError(true);
        setLoading(false);
      }
    );

    return () => {
      controller.abort();
      if (activeRequest.current === controller) {
        activeRequest.current = null;
      }
    };
  }, [searchRequest, sort, status]);

  return {
    data,
    error,
    loading,
    onCompositionEnd,
    onCompositionStart,
    onInput,
    refresh,
    removeDocument,
    setSort,
    setStatus,
    sort,
    status,
  };
};

import type { DocumentDiagnostic } from "./check-diagnostics.js";

/** Browser-safe data exchanged by the local document library. */
export interface LibraryDocument {
  diagnostics?: DocumentDiagnostic[];
  id: string;
  path: string;
  title: string;
  status: string;
  updatedAt: string;
}

/** UTF-16 offsets into the original display text, never normalized text. */
export interface LibraryMatch {
  start: number;
  end: number;
}

export interface LibraryResult extends LibraryDocument {
  excerpt: string;
  titleMatches: LibraryMatch[];
  excerptMatches: LibraryMatch[];
}

export interface LibraryWarning {
  path: string;
  reason: "read" | "parse";
}

export type LibrarySort = "relevance" | "updated" | "title";

export interface LibrarySearchOptions {
  query?: string;
  status?: string;
  sort?: LibrarySort;
}

export interface LibrarySearchResponse {
  root: string;
  results: LibraryResult[];
  total: number;
  matched: number;
  statuses: string[];
  warnings: LibraryWarning[];
}

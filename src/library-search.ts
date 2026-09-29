import type {
  LibraryDocument,
  LibraryMatch,
  LibraryResult,
  LibrarySearchOptions,
} from "./library-types.js";

export interface SearchableLibraryDocument extends LibraryDocument {
  body: string;
}

interface NormalizedText {
  ends: number[];
  starts: number[];
  text: string;
}

interface RankedDocument {
  bodyCoverage: number;
  document: SearchableLibraryDocument;
  excerpt: string;
  excerptMatches: LibraryMatch[];
  exactTitle: boolean;
  pathCoverage: number;
  titleCoverage: number;
  titleMatches: LibraryMatch[];
}

interface NormalizedDocument {
  body: NormalizedText;
  path: NormalizedText;
  sourceBody: string;
  sourcePath: string;
  sourceTitle: string;
  title: NormalizedText;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const titleCollator = new Intl.Collator("ja", {
  numeric: true,
  sensitivity: "base",
});
const normalizedDocuments = new WeakMap<
  SearchableLibraryDocument,
  NormalizedDocument
>();
const maxExcerptGraphemes = 180;
const excerptGraphemesBeforeMatch = 55;

const normalizeSegment = (value: string): string =>
  Array.from(value.normalize("NFKC").toLowerCase(), (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint >= 0x30_a1 && codePoint <= 0x30_f6
      ? String.fromCodePoint(codePoint - 0x60)
      : character;
  }).join("");

/** Normalize text for search while retaining the original grapheme offsets. */
const normalizeWithMap = (value: string): NormalizedText => {
  const parts: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];

  for (const { index, segment } of segmenter.segment(value)) {
    const normalized = normalizeSegment(segment);
    parts.push(normalized);
    for (const character of normalized) {
      starts.push(index);
      ends.push(index + segment.length);
      if (character.length === 2) {
        starts.push(index);
        ends.push(index + segment.length);
      }
    }
  }

  return { ends, starts, text: parts.join("") };
};

/** NFKC, case-folded and hiragana-normalized text for Japanese search. */
export const normalizeLibraryText = (value: string): string =>
  normalizeWithMap(value).text;

const queryTerms = (query: string): string[] => [
  ...new Set(normalizeLibraryText(query).split(/\s+/u).filter(Boolean)),
];

const normalizedDocument = (
  document: SearchableLibraryDocument
): NormalizedDocument => {
  const cached = normalizedDocuments.get(document);
  if (
    cached !== undefined &&
    cached.sourceBody === document.body &&
    cached.sourcePath === document.path &&
    cached.sourceTitle === document.title
  ) {
    return cached;
  }

  const normalized: NormalizedDocument = {
    body: normalizeWithMap(document.body),
    path: normalizeWithMap(document.path),
    sourceBody: document.body,
    sourcePath: document.path,
    sourceTitle: document.title,
    title: normalizeWithMap(document.title),
  };
  normalizedDocuments.set(document, normalized);
  return normalized;
};

const mergeMatches = (matches: readonly LibraryMatch[]): LibraryMatch[] => {
  const sorted = matches.toSorted(
    (left, right) => left.start - right.start || left.end - right.end
  );
  const merged: LibraryMatch[] = [];
  for (const match of sorted) {
    const previous = merged.at(-1);
    if (previous !== undefined && match.start <= previous.end) {
      previous.end = Math.max(previous.end, match.end);
    } else {
      merged.push({ ...match });
    }
  }
  return merged;
};

const findMatches = (
  text: NormalizedText,
  terms: readonly string[]
): LibraryMatch[] => {
  const matches: LibraryMatch[] = [];
  for (const term of terms) {
    let from = 0;
    while (from <= text.text.length - term.length) {
      const index = text.text.indexOf(term, from);
      if (index === -1) {
        break;
      }
      const start = text.starts[index];
      const end = text.ends[index + term.length - 1];
      if (start !== undefined && end !== undefined) {
        matches.push({ end, start });
      }
      from = index + 1;
    }
  }
  return mergeMatches(matches);
};

const graphemeBoundaries = (value: string): number[] => {
  const boundaries = [0];
  for (const { index, segment } of segmenter.segment(value)) {
    boundaries.push(index + segment.length);
  }
  return boundaries;
};

const lowerBound = (values: readonly number[], target: number): number => {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((values[middle] ?? 0) < target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};

const createExcerpt = (
  body: string,
  matches: readonly LibraryMatch[]
): { excerpt: string; matches: LibraryMatch[] } => {
  if (body.length === 0) {
    return { excerpt: "", matches: [] };
  }

  const boundaries = graphemeBoundaries(body);
  const graphemeCount = Math.max(0, boundaries.length - 1);
  if (graphemeCount <= maxExcerptGraphemes) {
    return { excerpt: body, matches: [...matches] };
  }

  const [firstMatch] = matches;
  const matchStartIndex =
    firstMatch === undefined ? 0 : lowerBound(boundaries, firstMatch.start);
  const matchEndIndex =
    firstMatch === undefined ? 0 : lowerBound(boundaries, firstMatch.end);
  let startIndex = Math.max(0, matchStartIndex - excerptGraphemesBeforeMatch);
  let endIndex = Math.min(graphemeCount, startIndex + maxExcerptGraphemes);

  if (matchEndIndex > endIndex) {
    endIndex = matchEndIndex;
    startIndex = Math.max(0, endIndex - maxExcerptGraphemes);
  }

  const start = boundaries[startIndex] ?? 0;
  const end = boundaries[endIndex] ?? body.length;
  const prefix = start > 0 ? "…" : "";
  const suffix = end < body.length ? "…" : "";
  const excerptMatches = matches
    .filter((match) => match.end > start && match.start < end)
    .map((match) => ({
      end: Math.min(match.end, end) - start + prefix.length,
      start: Math.max(match.start, start) - start + prefix.length,
    }));

  return {
    excerpt: `${prefix}${body.slice(start, end)}${suffix}`,
    matches: excerptMatches,
  };
};

const compareText = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
};

const compareDocuments = (
  left: RankedDocument,
  right: RankedDocument,
  sort: LibrarySearchOptions["sort"],
  hasQuery: boolean
): number => {
  if (sort === "updated") {
    return (
      compareText(right.document.updatedAt, left.document.updatedAt) ||
      titleCollator.compare(left.document.title, right.document.title) ||
      compareText(left.document.path, right.document.path)
    );
  }

  if (sort === "title") {
    return (
      titleCollator.compare(left.document.title, right.document.title) ||
      compareText(left.document.path, right.document.path)
    );
  }

  if (!hasQuery) {
    return (
      compareText(right.document.updatedAt, left.document.updatedAt) ||
      titleCollator.compare(left.document.title, right.document.title) ||
      compareText(left.document.path, right.document.path)
    );
  }

  return (
    Number(right.exactTitle) - Number(left.exactTitle) ||
    right.titleCoverage - left.titleCoverage ||
    right.bodyCoverage - left.bodyCoverage ||
    right.pathCoverage - left.pathCoverage ||
    titleCollator.compare(left.document.title, right.document.title) ||
    compareText(left.document.path, right.document.path)
  );
};

/** Search already-indexed documents without browser or filesystem APIs. */
export const searchLibraryDocuments = (
  documents: readonly SearchableLibraryDocument[],
  options: LibrarySearchOptions = {}
): LibraryResult[] => {
  const terms = queryTerms(options.query ?? "");
  const normalizedQuery = normalizeLibraryText(options.query ?? "");
  const status = options.status === "" ? undefined : options.status;
  const ranked: RankedDocument[] = [];

  for (const document of documents) {
    if (status !== undefined && document.status !== status) {
      continue;
    }

    const normalized = normalizedDocument(document);
    let titleCoverage = 0;
    let pathCoverage = 0;
    let bodyCoverage = 0;
    let matchesEveryTerm = true;

    for (const term of terms) {
      const inTitle = normalized.title.text.includes(term);
      const inPath = normalized.path.text.includes(term);
      const inBody = normalized.body.text.includes(term);
      titleCoverage += Number(inTitle);
      pathCoverage += Number(inPath);
      bodyCoverage += Number(inBody);
      matchesEveryTerm &&= inTitle || inPath || inBody;
    }

    if (!matchesEveryTerm) {
      continue;
    }

    const titleMatches = findMatches(normalized.title, terms);
    const bodyMatches = findMatches(normalized.body, terms);
    const excerpt = createExcerpt(document.body, bodyMatches);
    ranked.push({
      bodyCoverage,
      document,
      exactTitle: terms.length > 0 && normalized.title.text === normalizedQuery,
      excerpt: excerpt.excerpt,
      excerptMatches: excerpt.matches,
      pathCoverage,
      titleCoverage,
      titleMatches,
    });
  }

  const ordered = ranked.toSorted((left, right) =>
    compareDocuments(left, right, options.sort ?? "relevance", terms.length > 0)
  );

  return ordered.map(({ document, excerpt, excerptMatches, titleMatches }) => ({
    excerpt,
    excerptMatches,
    id: document.id,
    path: document.path,
    status: document.status,
    title: document.title,
    titleMatches,
    updatedAt: document.updatedAt,
  }));
};

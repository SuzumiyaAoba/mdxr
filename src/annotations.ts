import { isRecord } from "./guards.js";

export interface AnnotationSource {
  file: string;
  start: number;
  end: number;
  text: string;
  heading: string;
  label: string;
  image: string;
}

export interface AnnotationDocument {
  id?: string;
  file: string;
  revision: string;
  title: string;
  sources: AnnotationSource[];
  contentHash?: string;
}

export interface AnnotationAnchor {
  kind: "text" | "figure";
  revision: string;
  /** Child-element indexes from #mdxr-root; never an executable selector. */
  path: number[];
  quote: string;
  heading: string;
  prefix: string;
  suffix: string;
  start: number;
  end: number;
  image: string;
  /** Original location, retained if the document later changes. */
  source?: AnnotationSource;
}

export interface DocumentAnnotation {
  id: string;
  comment: string;
  anchor: AnnotationAnchor;
  status?: AnnotationStatus;
  resolution?: AnnotationResolution;
}

export type AnnotationStatus = "open" | "resolved";

export interface AnnotationVersion {
  id: string;
  contentHash: string;
  createdAt: string;
  sequence: number;
}

export interface AnnotationResolution {
  revision: string;
  resolvedAt: string;
  version?: AnnotationVersion;
}

export interface AnnotationBatch {
  id: string;
  createdAt: string;
  action: "copy" | "send";
  annotations: DocumentAnnotation[];
  markdown: string;
}

export interface AnnotationStore {
  annotations: DocumentAnnotation[];
  history: AnnotationBatch[];
}

export const annotationStatus = (
  annotation: DocumentAnnotation
): AnnotationStatus => annotation.status ?? "open";

export const normalizeAnnotationText = (text: string): string =>
  text.replaceAll(/\s+/gu, " ").trim();

/** Report a source range only when the rendered target identifies one block. */
export const findAnnotationSource = (
  anchor: AnnotationAnchor,
  sources: readonly AnnotationSource[]
): AnnotationSource | undefined => {
  const quote = normalizeAnnotationText(anchor.quote);
  let matches = sources.filter((source) =>
    anchor.kind === "text"
      ? quote !== "" && normalizeAnnotationText(source.text).includes(quote)
      : (anchor.image !== "" && source.image === anchor.image) ||
        (quote !== "" && normalizeAnnotationText(source.label) === quote)
  );
  if (matches.length > 1 && anchor.heading !== "") {
    const contextual = matches.filter(
      (source) => source.heading === anchor.heading
    );
    if (contextual.length > 0) {
      matches = contextual;
    }
  }
  // JSX containers and their paragraphs can describe the same source region.
  matches = matches.filter(
    (source) =>
      !matches.some(
        (other) =>
          other !== source &&
          other.file === source.file &&
          other.start >= source.start &&
          other.end <= source.end &&
          other.end - other.start < source.end - source.start
      )
  );
  const [first] = matches;
  return first !== undefined &&
    matches.every(
      (source) =>
        source.file === first.file &&
        source.start === first.start &&
        source.end === first.end
    )
    ? first
    : undefined;
};

const markdownText = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(/(?<symbol>[\\`*_{}[\]()#+.!|>~-])/gu, "\\$<symbol>");

const codeSpan = (value: string): string => {
  const runs = value.match(/`+/gu) ?? [];
  const fence = "`".repeat(Math.max(0, ...runs.map((run) => run.length)) + 1);
  return `${fence} ${value.replaceAll(/[\r\n]/gu, " ")} ${fence}`;
};

export const annotationLocation = (source: AnnotationSource): string =>
  `${source.file}:${source.start}${source.end === source.start ? "" : `-${source.end}`}`;

/** Plain Markdown handoff; quotes are data, while comments retain Markdown. */
export const annotationsMarkdown = (
  document: Pick<AnnotationDocument, "file" | "title">,
  annotations: readonly DocumentAnnotation[],
  detached: ReadonlySet<string> = new Set()
): string => {
  const openAnnotations = annotations.filter(
    (annotation) => annotationStatus(annotation) === "open"
  );
  const lines = [
    `# Feedback: ${markdownText(normalizeAnnotationText(document.title))}`,
    "",
    `Document: ${codeSpan(document.file)}`,
    "",
    "Please address the following review comments in the source document.",
  ];
  for (const [index, annotation] of openAnnotations.entries()) {
    const { anchor, comment } = annotation;
    lines.push(
      "",
      `## ${index + 1}. ${anchor.kind === "text" ? "Text" : "Figure"} comment`,
      `Comment ID: ${codeSpan(annotation.id)}`,
      ""
    );
    if (anchor.source !== undefined) {
      lines.push(
        `Source block: ${codeSpan(annotationLocation(anchor.source))}`
      );
    }
    if (anchor.heading !== "") {
      lines.push(`Section: ${markdownText(anchor.heading)}`);
    }
    if (anchor.image !== "") {
      lines.push(`Image: ${codeSpan(anchor.image)}`);
    }
    if (detached.has(annotation.id)) {
      lines.push(
        "Target no longer found in the current rendering; the quote and source location below refer to the original selection."
      );
    }
    lines.push(
      "",
      ...anchor.quote.split(/\r?\n/u).map((line) => `> ${markdownText(line)}`),
      "",
      "**Comment**",
      "",
      comment.trim()
    );
  }
  return `${lines.join("\n")}\n`;
};

const isIndex = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const HASH_PATTERN = /^[\da-f]{64}$/iu;
const VERSION_ID_PATTERN =
  /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value !== "";

const isSource = (value: unknown): value is AnnotationSource =>
  isRecord(value) &&
  ["file", "text", "heading", "label", "image"].every(
    (key) => typeof value[key] === "string"
  ) &&
  isIndex(value.start) &&
  value.start > 0 &&
  isIndex(value.end) &&
  value.end >= value.start;

const isAnchor = (value: unknown): value is AnnotationAnchor =>
  isRecord(value) &&
  (value.kind === "text" || value.kind === "figure") &&
  Array.isArray(value.path) &&
  value.path.every(isIndex) &&
  ["quote", "heading", "prefix", "suffix", "image", "revision"].every(
    (key) => typeof value[key] === "string"
  ) &&
  isIndex(value.start) &&
  isIndex(value.end) &&
  value.end >= value.start &&
  (value.source === undefined || isSource(value.source));

const isIsoTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;

export const isAnnotationVersion = (
  value: unknown
): value is AnnotationVersion =>
  isRecord(value) &&
  typeof value.id === "string" &&
  VERSION_ID_PATTERN.test(value.id) &&
  typeof value.contentHash === "string" &&
  HASH_PATTERN.test(value.contentHash) &&
  isIsoTimestamp(value.createdAt) &&
  typeof value.sequence === "number" &&
  Number.isSafeInteger(value.sequence) &&
  value.sequence >= 1;

const isAnnotationResolution = (
  value: unknown
): value is AnnotationResolution =>
  isRecord(value) &&
  isNonEmptyString(value.revision) &&
  isIsoTimestamp(value.resolvedAt) &&
  (value.version === undefined || isAnnotationVersion(value.version));

const isAnnotation = (value: unknown): value is DocumentAnnotation => {
  if (!isRecord(value)) {
    return false;
  }
  const status = value.status === undefined ? "open" : value.status;
  return (
    isNonEmptyString(value.id) &&
    typeof value.comment === "string" &&
    value.comment.trim() !== "" &&
    isAnchor(value.anchor) &&
    (status === "open" || status === "resolved") &&
    (status === "resolved"
      ? isAnnotationResolution(value.resolution)
      : value.resolution === undefined)
  );
};

const isAnnotationBatch = (value: unknown): value is AnnotationBatch =>
  isRecord(value) &&
  typeof value.id === "string" &&
  value.id !== "" &&
  isIsoTimestamp(value.createdAt) &&
  (value.action === "copy" || value.action === "send") &&
  Array.isArray(value.annotations) &&
  value.annotations.every(isAnnotation) &&
  typeof value.markdown === "string";

const hasUniqueAnnotationIds = (
  annotations: readonly DocumentAnnotation[]
): boolean =>
  new Set(annotations.map(({ id }) => id)).size === annotations.length;

const restoreArchivedAnnotations = (
  current: DocumentAnnotation[],
  history: readonly AnnotationBatch[]
): DocumentAnnotation[] => {
  const currentIds = new Set(current.map(({ id }) => id));
  const latestSnapshots = new Map<string, DocumentAnnotation>();
  for (const batch of history) {
    for (const annotation of batch.annotations) {
      latestSnapshots.delete(annotation.id);
      latestSnapshots.set(annotation.id, annotation);
    }
  }
  const recovered = [...latestSnapshots]
    .filter(([id]) => !currentIds.has(id))
    .map(([, annotation]) => structuredClone(annotation));
  return [...current, ...recovered];
};

export const parseAnnotationStore = (raw: string | null): AnnotationStore => {
  if (raw === null) {
    return { annotations: [], history: [] };
  }
  const value: unknown = JSON.parse(raw);
  if (
    !isRecord(value) ||
    (value.version !== 1 && value.version !== 2) ||
    !Array.isArray(value.annotations) ||
    !value.annotations.every(isAnnotation)
  ) {
    throw new Error("Invalid saved annotations");
  }
  const annotations: DocumentAnnotation[] = value.annotations;
  if (!hasUniqueAnnotationIds(annotations)) {
    throw new Error("Duplicate annotation identifiers");
  }

  const rawHistory = value.history;
  if (rawHistory === undefined) {
    if (value.version === 2) {
      throw new Error("Invalid saved annotation history");
    }
    return { annotations, history: [] };
  }
  if (!Array.isArray(rawHistory) || !rawHistory.every(isAnnotationBatch)) {
    throw new Error("Invalid saved annotation history");
  }
  const history: AnnotationBatch[] = rawHistory;
  if (new Set(history.map(({ id }) => id)).size !== history.length) {
    throw new Error("Duplicate annotation batch identifiers");
  }
  if (history.some((batch) => !hasUniqueAnnotationIds(batch.annotations))) {
    throw new Error("Duplicate annotation identifiers in batch");
  }
  return {
    annotations:
      value.version === 1
        ? restoreArchivedAnnotations(annotations, history)
        : annotations,
    history,
  };
};

export const parseAnnotations = (raw: string | null): DocumentAnnotation[] =>
  parseAnnotationStore(raw).annotations;

export const parseAnnotationDocument = (
  raw: string
): AnnotationDocument | undefined => {
  const value: unknown = JSON.parse(raw);
  return isRecord(value) &&
    typeof value.file === "string" &&
    typeof value.title === "string" &&
    typeof value.revision === "string" &&
    (value.contentHash === undefined ||
      (typeof value.contentHash === "string" &&
        HASH_PATTERN.test(value.contentHash))) &&
    Array.isArray(value.sources) &&
    value.sources.every(isSource)
    ? {
        ...(typeof value.id === "string" ? { id: value.id } : {}),
        file: value.file,
        revision: value.revision,
        sources: value.sources,
        title: value.title,
        ...(value.contentHash === undefined
          ? {}
          : { contentHash: value.contentHash }),
      }
    : undefined;
};

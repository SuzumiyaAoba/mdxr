import { parseAnnotationStore } from "./annotations.js";
import type { AnnotationStore } from "./annotations.js";
import { isRecord } from "./guards.js";

// Accept previously downloaded review files without branding new bundles.
const LEGACY_REVIEW_FORMAT = ["md", "xr-review"].join("");

export interface ReviewTransfer {
  format: "doc-review";
  version: 1;
  document: { id: string; file: string; revision: string; title: string };
  exportedAt: string;
  annotations: AnnotationStore;
  sections: { id: string; revision: string; title: string }[];
}

const isReviewDocument = (
  value: unknown
): value is ReviewTransfer["document"] =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.file === "string" &&
  typeof value.revision === "string" &&
  typeof value.title === "string";
const isReviewedSection = (
  value: unknown
): value is ReviewTransfer["sections"][number] =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.revision === "string" &&
  typeof value.title === "string";

export const parseReviewTransfer = (raw: string): ReviewTransfer => {
  const value: unknown = JSON.parse(raw);
  if (
    !isRecord(value) ||
    (value.format !== "doc-review" && value.format !== LEGACY_REVIEW_FORMAT) ||
    value.version !== 1 ||
    !isReviewDocument(value.document) ||
    typeof value.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(value.exportedAt)) ||
    !isRecord(value.annotations) ||
    !Array.isArray(value.sections) ||
    !value.sections.every(isReviewedSection)
  ) {
    throw new Error("Invalid review file or unsupported format version");
  }
  const annotations = parseAnnotationStore(
    JSON.stringify({ ...value.annotations, version: 2 })
  );
  const { sections } = value;
  if (new Set(sections.map(({ id }) => id)).size !== sections.length) {
    throw new Error("Duplicate section identifiers");
  }
  return {
    annotations,
    document: value.document,
    exportedAt: value.exportedAt,
    format: "doc-review",
    sections,
    version: 1,
  };
};

/** Retain local conflicts unless the reader explicitly selects imported records. */
export const mergeReviews = (
  local: AnnotationStore,
  incoming: AnnotationStore,
  preferIncoming = false
): { store: AnnotationStore; added: number; conflicts: number } => {
  let added = 0;
  let conflicts = 0;
  const merge = <T extends { id: string }>(left: T[], right: T[]): T[] => {
    const records = new Map(left.map((record) => [record.id, record]));
    for (const record of right) {
      const previous = records.get(record.id);
      if (previous === undefined) {
        added += 1;
        records.set(record.id, record);
      } else if (JSON.stringify(previous) !== JSON.stringify(record)) {
        conflicts += 1;
        if (preferIncoming) {
          records.set(record.id, record);
        }
      }
    }
    return [...records.values()];
  };
  const annotations = merge(local.annotations, incoming.annotations);
  const history = merge(local.history, incoming.history);
  return { added, conflicts, store: { annotations, history } };
};

export const REVIEW_IMPORT_EVENT = "doc:import-review" as const;
declare global {
  interface DocumentEventMap {
    "doc:import-review": CustomEvent<{
      annotations: AnnotationStore;
      sections: ReviewTransfer["sections"];
      errors: string[];
    }>;
  }
}

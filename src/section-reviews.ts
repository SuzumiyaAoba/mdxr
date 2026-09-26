import { isRecord, nonEmpty } from "./guards.js";

export interface SectionReview {
  id: string;
  revision: string;
}

const isSectionReview = (value: unknown): value is SectionReview =>
  isRecord(value) && nonEmpty(value.id) && nonEmpty(value.revision);

/** Only reviewed revisions are saved; missing or changed sections are pending. */
export const parseSectionReviews = (raw: string | null): SectionReview[] => {
  if (raw === null) {
    return [];
  }
  const value: unknown = JSON.parse(raw);
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.sections) ||
    !value.sections.every(isSectionReview)
  ) {
    throw new Error("Invalid saved section reviews");
  }
  const sections: SectionReview[] = value.sections;
  if (new Set(sections.map(({ id }) => id)).size !== sections.length) {
    throw new Error("Duplicate section review identifiers");
  }
  return sections;
};

import { isAnnotationVersion } from "../annotations.js";
import type {
  AnnotationDocument,
  AnnotationResolution,
  AnnotationVersion,
} from "../annotations.js";
import { isRecord } from "../guards.js";

/** A static HTML document can record a revision without a local version store. */
const hasDocumentHistory = (): boolean =>
  document.querySelector("#mdxr-workspace-root") !== null ||
  window.location.pathname === "/__mdxr_history";

/** Bind the decision to the rendered source, even if a newer version exists. */
export const resolveAnnotationVersion = async (
  info: AnnotationDocument
): Promise<AnnotationResolution> => {
  const resolution: AnnotationResolution = {
    resolvedAt: new Date().toISOString(),
    revision: info.revision,
  };
  if (!hasDocumentHistory()) {
    return resolution;
  }
  const response = await fetch("/__mdxr_history", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Document history is unavailable");
  }
  const value: unknown = await response.json();
  if (
    !isRecord(value) ||
    !Array.isArray(value.versions) ||
    !value.versions.every(isAnnotationVersion)
  ) {
    throw new Error("Invalid document history");
  }
  const versions: AnnotationVersion[] = value.versions;
  const version = versions
    .toReversed()
    .find((candidate) => candidate.contentHash === info.contentHash);
  if (version === undefined) {
    throw new Error("The displayed version is not in the document history");
  }
  return {
    ...resolution,
    version: {
      contentHash: version.contentHash,
      createdAt: version.createdAt,
      id: version.id,
      sequence: version.sequence,
    },
  };
};

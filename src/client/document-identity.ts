import type { AnnotationDocument } from "../annotations.js";
import { readDocumentStorage } from "./storage.js";

/** Copy legacy path-based records once, retaining the original for recovery. */
export const documentStorageKey = (
  prefix: string,
  info: AnnotationDocument
): string => {
  const previous = `${prefix}${info.file}`;
  const key = `${prefix}${info.id ?? info.file}`;
  try {
    const legacy = readDocumentStorage(localStorage, previous);
    if (
      key !== previous &&
      legacy !== null &&
      readDocumentStorage(localStorage, key) === null
    ) {
      localStorage.setItem(key, legacy);
    }
  } catch {
    /* The owning controller reports unavailable storage. */
  }
  return key;
};

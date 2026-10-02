import { describe, expect, it, vi } from "vitest";

import { documentStorageKey } from "../src/client/document-identity.js";
import {
  readDocumentStorage,
  removeDocumentStorage,
} from "../src/client/storage.js";

const storageFor = (records: Map<string, string>): Storage => ({
  clear: () => {
    records.clear();
  },
  getItem: (key) => records.get(key) ?? null,
  key: (index) => [...records.keys()][index] ?? null,
  get length() {
    return records.size;
  },
  removeItem: (key) => {
    records.delete(key);
  },
  setItem: (key, value) => {
    records.set(key, value);
  },
});

describe("document storage namespace compatibility", () => {
  it("restores old annotations and answers, preferring newer records", () => {
    const records = new Map([
      ["mdxr:annotations:v1:document", "old comments"],
      ["mdxr:widgets:v1:document", "old answers"],
      ["doc:annotations:v1:document", "new comments"],
    ]);
    const storage = storageFor(records);
    expect(readDocumentStorage(storage, "doc:annotations:v1:document")).toBe(
      "new comments"
    );
    expect(readDocumentStorage(storage, "doc:widgets:v1:document")).toBe(
      "old answers"
    );
    expect(records.get("mdxr:widgets:v1:document")).toBe("old answers");
  });

  it("clears both theme keys when returning to automatic mode", () => {
    const records = new Map([
      ["mdxr-theme", "dark"],
      ["doc-theme", "light"],
    ]);
    const storage = storageFor(records);
    removeDocumentStorage(storage, "doc-theme");
    expect(readDocumentStorage(storage, "doc-theme")).toBeNull();
  });

  it("copies legacy file-based records to the stable document identity", () => {
    const records = new Map([
      ["mdxr:widgets:v1:/project/document.mdx", "answers"],
    ]);
    vi.stubGlobal("localStorage", storageFor(records));
    try {
      expect(
        documentStorageKey("doc:widgets:v1:", {
          contentHash: "hash",
          file: "/project/document.mdx",
          id: "document-id",
          revision: "revision",
          sources: [],
          title: "Document",
        })
      ).toBe("doc:widgets:v1:document-id");
      expect(records.get("doc:widgets:v1:document-id")).toBe("answers");
      expect(records.get("mdxr:widgets:v1:/project/document.mdx")).toBe(
        "answers"
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each(["doc", "mdxr"])(
    "preserves newer %s identity records when legacy path records remain",
    (namespace) => {
      const records = new Map([
        ["mdxr:widgets:v1:/project/document.mdx", "old answers"],
        [`${namespace}:widgets:v1:document-id`, "new answers"],
      ]);
      const storage = storageFor(records);
      vi.stubGlobal("localStorage", storage);
      try {
        const key = documentStorageKey("doc:widgets:v1:", {
          contentHash: "hash",
          file: "/project/document.mdx",
          id: "document-id",
          revision: "revision",
          sources: [],
          title: "Document",
        });
        expect(readDocumentStorage(storage, key)).toBe("new answers");
        expect(records.get("mdxr:widgets:v1:/project/document.mdx")).toBe(
          "old answers"
        );
      } finally {
        vi.unstubAllGlobals();
      }
    }
  );
});

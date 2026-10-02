import { parseAnnotationDocument } from "../annotations.js";
import { parseWidgetState } from "../widget-state.js";
import type { WidgetRecord } from "../widget-state.js";
import { syncBoards } from "./doc-events/board.js";
import { documentStorageKey } from "./document-identity.js";
import { readDocumentStorage } from "./storage.js";
import { createWidgets } from "./widget-controls.js";

export const initWidgetAutosave = (): void => {
  const info = parseAnnotationDocument(
    document.querySelector("#doc-annotation-document")?.textContent ?? "{}"
  );
  if (info === undefined) {
    return;
  }
  const key = documentStorageKey("doc:widgets:v1:", info);
  let records = new Map<string, WidgetRecord>();
  let storageError: string | undefined;
  const readRecords = (): Map<string, WidgetRecord> =>
    new Map(
      parseWidgetState(readDocumentStorage(localStorage, key)).records.map(
        (record) => [record.key, record]
      )
    );
  const notice = (message: string): void => {
    let status = document.querySelector<HTMLElement>("#doc-widget-status");
    if (status === null) {
      status = document.createElement("div");
      status.id = "doc-widget-status";
      status.setAttribute("role", "status");
      document.querySelector("#doc-content")?.append(status);
    }
    status.textContent = message;
    if (records.size > 0) {
      const download = document.createElement("button");
      download.type = "button";
      download.textContent = "Download retained answers";
      download.addEventListener("click", () => {
        const url = URL.createObjectURL(
          new Blob(
            [
              JSON.stringify(
                { records: [...records.values()], version: 1 },
                null,
                2
              ),
            ],
            { type: "application/json" }
          )
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "doc-answers.json";
        anchor.click();
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 1000);
      });
      status.append(" ", download);
    }
  };
  const restore = (): void => {
    try {
      records = readRecords();
    } catch {
      storageError =
        "Saved answers could not be read. Existing data was retained.";
      notice(storageError);
    }
    const current = createWidgets();
    for (const [recordKey, widget] of current) {
      const saved = records.get(recordKey);
      if (saved?.signature === widget.record().signature) {
        widget.restore(saved);
      }
    }
    syncBoards(document);
    const stale = [...records.values()].filter(
      (record) =>
        current.get(record.key)?.record().signature !== record.signature
    );
    if (stale.length > 0) {
      notice(
        `${stale.length} saved answers or boards could not be restored because their questions, options or identifiers changed. The original records are retained.`
      );
    }
    const save = (event: Event): void => {
      const { target } = event;
      if (!(target instanceof Element)) {
        return;
      }
      const edited = [...current.values()].filter(({ element }) =>
        element.contains(target)
      );
      if (edited.length === 0) {
        return;
      }
      if (storageError === undefined) {
        try {
          // Merge changes from other tabs before replacing the edited widget.
          records = readRecords();
        } catch {
          storageError =
            "Saved answers could not be read. Existing data was retained.";
        }
      }
      // Keep collecting edits for download even after storage becomes unavailable.
      for (const widget of edited) {
        const next = widget.record();
        const previous = records.get(next.key);
        if (previous !== undefined && previous.signature !== next.signature) {
          records.set(`retained:${next.key}:${previous.signature}`, {
            ...previous,
            key: `retained:${next.key}:${previous.signature}`,
          });
        }
        records.set(next.key, next);
      }
      if (storageError !== undefined) {
        notice(storageError);
        return;
      }
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ records: [...records.values()], version: 1 })
        );
      } catch {
        storageError =
          "Answers could not be saved. Download them before leaving this page.";
        notice(storageError);
      }
    };
    for (const event of ["input", "change", "doc:boardchange"]) {
      document.addEventListener(event, save);
    }
  };
  if (document.querySelector('[data-doc-hydration="true"]') === null) {
    restore();
  } else {
    document.addEventListener("doc:hydrated", restore, { once: true });
  }
};

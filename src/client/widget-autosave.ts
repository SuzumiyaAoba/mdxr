import { parseAnnotationDocument } from "../annotations.js";
import { parseWidgetState } from "../widget-state.js";
import type { WidgetRecord } from "../widget-state.js";
import { syncBoards } from "./doc-events/board.js";
import { documentStorageKey } from "./document-identity.js";
import { createWidgets } from "./widget-controls.js";

export const initWidgetAutosave = (): void => {
  const info = parseAnnotationDocument(
    document.querySelector("#mdxr-annotation-document")?.textContent ?? "{}"
  );
  if (info === undefined) {
    return;
  }
  const key = documentStorageKey("mdxr:widgets:v1:", info);
  let records = new Map<string, WidgetRecord>();
  let writable = true;
  const notice = (message: string): void => {
    let status = document.querySelector<HTMLElement>("#mdxr-widget-status");
    if (status === null) {
      status = document.createElement("div");
      status.id = "mdxr-widget-status";
      status.setAttribute("role", "status");
      document.querySelector("#mdxr-content")?.append(status);
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
        anchor.download = "mdxr-answers.json";
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
      records = new Map(
        parseWidgetState(localStorage.getItem(key)).records.map((record) => [
          record.key,
          record,
        ])
      );
    } catch {
      writable = false;
      notice("Saved answers could not be read. Existing data was retained.");
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
      if (!writable || !(event.target instanceof Element)) {
        return;
      }
      for (const [recordKey, widget] of current) {
        if (
          widget.element === event.target ||
          widget.element.contains(event.target)
        ) {
          const next = widget.record();
          const previous = records.get(recordKey);
          if (previous !== undefined && previous.signature !== next.signature) {
            records.set(`retained:${recordKey}:${previous.signature}`, {
              ...previous,
              key: `retained:${recordKey}:${previous.signature}`,
            });
          }
          records.set(recordKey, next);
        }
      }
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ records: [...records.values()], version: 1 })
        );
      } catch {
        writable = false;
        notice(
          "Answers could not be saved. Download them before leaving this page."
        );
      }
    };
    for (const event of ["input", "change", "mdxr:boardchange"]) {
      document.addEventListener(event, save);
    }
  };
  if (document.querySelector('[data-mdxr-hydration="true"]') === null) {
    restore();
  } else {
    document.addEventListener("mdxr:hydrated", restore, { once: true });
  }
};

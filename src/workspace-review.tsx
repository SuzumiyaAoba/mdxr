import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";

import type { AnnotationDocument } from "./annotations.js";
import { parseAnnotationDocument } from "./annotations.js";
import { collectWorkspaceBrowserState } from "./client/workspace-export-state.js";
import {
  mergeReviews,
  parseReviewTransfer,
  REVIEW_IMPORT_EVENT,
} from "./review-transfer.js";
import type { ReviewTransfer } from "./review-transfer.js";
import { downloadText } from "./ui/data-download.js";

const documentInfo = (): (AnnotationDocument & { id: string }) | undefined => {
  const info = parseAnnotationDocument(
    document.querySelector("#mdxr-annotation-document")?.textContent ?? "{}"
  );
  return info === undefined ? undefined : { ...info, id: info.id ?? info.file };
};

const readReview = async (file: File): Promise<ReviewTransfer> => {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Review file exceeds 10 MB");
  }
  return parseReviewTransfer(await file.text());
};

export const WorkspaceReviewButton = () => {
  const [open, setOpen] = useState(false);
  const [incoming, setIncoming] = useState<ReviewTransfer>();
  const [mapDocument, setMapDocument] = useState(false);
  const [preferIncoming, setPreferIncoming] = useState(false);
  const [message, setMessage] = useState("");
  const info = documentInfo();
  const local = collectWorkspaceBrowserState();
  const merged =
    incoming === undefined
      ? undefined
      : mergeReviews(local.annotations, incoming.annotations, preferIncoming);
  const stale =
    incoming?.sections.filter(
      (section) =>
        !local.sectionReviews.some(
          (current) =>
            current.id === section.id && current.revision === section.revision
        )
    ).length ?? 0;
  const mismatch = incoming !== undefined && incoming.document.id !== info?.id;
  if (info === undefined) {
    return null;
  }
  const save = (): void => {
    try {
      const state = collectWorkspaceBrowserState();
      const data: ReviewTransfer = {
        annotations: state.annotations,
        document: {
          file: info.file,
          id: info.id,
          revision: info.revision,
          title: info.title,
        },
        exportedAt: new Date().toISOString(),
        format: "mdxr-review",
        sections: state.sectionReviews
          .filter(({ reviewed }) => reviewed)
          .map(({ id, revision, title }) => ({ id, revision, title })),
        version: 1,
      };
      downloadText(
        JSON.stringify(data, null, 2),
        "mdxr-review.json",
        "application/json"
      );
      setMessage("Review JSON downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };
  const load = async (file: File | undefined): Promise<void> => {
    setIncoming(undefined);
    setMapDocument(false);
    setPreferIncoming(false);
    if (file === undefined) {
      return;
    }
    try {
      setIncoming(await readReview(file));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };
  const apply = (): void => {
    if (incoming === undefined || (mismatch && !mapDocument)) {
      return;
    }
    const latest = mergeReviews(
      collectWorkspaceBrowserState().annotations,
      incoming.annotations,
      preferIncoming
    );
    const detail = {
      annotations: latest.store,
      errors: [] as string[],
      sections: incoming.sections,
    };
    document.dispatchEvent(new CustomEvent(REVIEW_IMPORT_EVENT, { detail }));
    const detached =
      collectWorkspaceBrowserState().detachedAnnotationIds.length;
    setMessage(
      `Imported: ${latest.added} added, ${latest.conflicts} conflicts (${preferIncoming ? "imported" : "local"} records retained), ${stale} changed or missing sections skipped, ${detached} detached comments retained.${detail.errors.length === 0 ? "" : ` ${detail.errors.join(". ")}`}`
    );
    setIncoming(undefined);
  };
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        type="button"
        className="mdxr-workspace-export"
        aria-label="Save or import review"
        title="Save or import review"
      >
        Review
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="mdxr-workspace-export-backdrop" />
        <Dialog.Popup className="mdxr-workspace-export-dialog">
          <Dialog.Title>Save or import review</Dialog.Title>
          <Dialog.Description>
            Transfer comments and reviewed sections as versioned JSON.
          </Dialog.Description>
          <button type="button" onClick={save}>
            Download review JSON
          </button>
          <label>
            Import review JSON
            <input
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                void load(event.target.files?.[0]);
              }}
            />
          </label>
          {incoming !== undefined && (
            <div>
              <p>
                {merged?.added} new records; {merged?.conflicts} conflicts.{" "}
                {stale} changed or missing sections will remain unreviewed.
                Comments keep their original quotes and locations.
              </p>
              {incoming.document.revision !== info.revision && (
                <p>
                  The document revision differs. Comment targets will be matched
                  against the current text.
                </p>
              )}
              {mismatch && (
                <label>
                  <input
                    type="checkbox"
                    checked={mapDocument}
                    onChange={(event) => {
                      setMapDocument(event.target.checked);
                    }}
                  />{" "}
                  Map reviews from {incoming.document.file} to this document
                </label>
              )}
              {(merged?.conflicts ?? 0) > 0 && (
                <label>
                  <input
                    type="checkbox"
                    checked={preferIncoming}
                    onChange={(event) => {
                      setPreferIncoming(event.target.checked);
                    }}
                  />{" "}
                  Use imported records for conflicts
                </label>
              )}
              <button
                type="button"
                disabled={mismatch && !mapDocument}
                onClick={apply}
              >
                Merge review
              </button>
            </div>
          )}
          {message !== "" && <output>{message}</output>}
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

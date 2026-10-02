import { useEffect, useRef, useState } from "react";

import type { LibraryDocument } from "./library-types.js";

interface DeleteCopy {
  cancel: string;
  delete: string;
  deleteDescription: string;
  deleteError: string;
  deleteTitle: string;
  deleting: string;
}

const deleteDocument = async (
  id: string,
  handleSettled: (deleted: boolean) => void
): Promise<void> => {
  let deleted = false;
  try {
    const response = await fetch(
      `/__doc_library/document/${encodeURIComponent(id)}`,
      {
        headers: { "X-Doc-Library-Action": "delete" },
        method: "DELETE",
      }
    );
    deleted = response.ok;
  } catch {
    // Network failures leave the document visible and allow another attempt.
  } finally {
    handleSettled(deleted);
  }
};

export const LibraryDeleteDialog = ({
  copy,
  document: target,
  handleCancel,
  handleDeleted,
}: {
  copy: DeleteCopy;
  document: LibraryDocument;
  handleCancel: () => void;
  handleDeleted: (id: string) => void;
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    mounted.current = true;
    dialog?.showModal();
    return () => {
      mounted.current = false;
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      } else {
        document
          .querySelector<HTMLInputElement>(".doc-library__search input")
          ?.focus();
      }
    };
  }, []);

  const handleConfirm = (): void => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError(false);
    void deleteDocument(target.id, (deleted) => {
      inFlight.current = false;
      if (!mounted.current) {
        return;
      }
      setPending(false);
      if (deleted) {
        handleDeleted(target.id);
      } else {
        setError(true);
      }
    });
  };

  return (
    <dialog
      aria-busy={pending}
      aria-describedby="doc-library-delete-description doc-library-delete-path"
      aria-labelledby="doc-library-delete-title"
      className="doc-library__delete-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!inFlight.current) {
          handleCancel();
        }
      }}
      ref={dialogRef}
      role="alertdialog"
    >
      <h2 id="doc-library-delete-title">{copy.deleteTitle}</h2>
      <div className="doc-library__delete-target">
        <p>{target.title}</p>
        <p id="doc-library-delete-path">{target.path}</p>
      </div>
      <p id="doc-library-delete-description">{copy.deleteDescription}</p>
      {error && (
        <p className="doc-library__delete-error" role="alert">
          {copy.deleteError}
        </p>
      )}
      <div className="doc-library__delete-actions">
        <button disabled={pending} onClick={handleCancel} type="button">
          {copy.cancel}
        </button>
        <button
          className="doc-library__delete-confirm"
          disabled={pending}
          onClick={handleConfirm}
          type="button"
        >
          {pending ? copy.deleting : copy.delete}
        </button>
      </div>
    </dialog>
  );
};

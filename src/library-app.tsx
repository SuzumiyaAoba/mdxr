import { useState } from "react";
import { createRoot } from "react-dom/client";

import { LibraryControls, LibraryToolbar } from "./library-controls.js";
import { LibraryDeleteDialog } from "./library-delete.js";
import { useLibraryLanguage } from "./library-language.js";
import { LibraryResults } from "./library-results.js";
import { useLibrarySearch } from "./library-state.js";
import type { LibraryResult } from "./library-types.js";

const LibraryApp = () => {
  const { copy, language, toggleLanguage } = useLibraryLanguage();
  const [deleteTarget, setDeleteTarget] = useState<LibraryResult | null>(null);
  const state = useLibrarySearch();

  return (
    <>
      <LibraryControls copy={copy} handleLanguageChange={toggleLanguage} />
      <main aria-label={copy.title} className="mdxr-library">
        <div className="mdxr-library__shell">
          <LibraryToolbar
            copy={copy}
            handleCompositionEnd={state.onCompositionEnd}
            handleCompositionStart={state.onCompositionStart}
            handleInput={state.onInput}
            handleRefresh={state.refresh}
            handleSort={state.setSort}
            handleStatus={state.setStatus}
            language={language}
            loading={state.loading}
            sort={state.sort}
            status={state.status}
            statuses={state.data?.statuses ?? []}
          />
          <LibraryResults
            copy={copy}
            data={state.data}
            error={state.error}
            handleDelete={setDeleteTarget}
            handleRefresh={state.refresh}
            language={language}
            loading={state.loading}
          />
        </div>
      </main>
      {deleteTarget !== null && (
        <LibraryDeleteDialog
          copy={copy}
          document={deleteTarget}
          handleCancel={() => {
            setDeleteTarget(null);
          }}
          handleDeleted={(id) => {
            state.removeDocument(id);
            setDeleteTarget(null);
          }}
          key={deleteTarget.id}
        />
      )}
    </>
  );
};

const root = document.querySelector<HTMLElement>("#mdxr-library-root");
if (root !== null) {
  createRoot(root).render(<LibraryApp />);
}

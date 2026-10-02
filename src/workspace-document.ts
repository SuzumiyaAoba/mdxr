import { useEffect } from "react";

import type { ViewMode } from "./workspace-state.js";

/** Keep the server-rendered document controls in sync with the workspace. */
export const useWorkspaceDocument = ({
  chatOpen,
  provider,
  selection,
  view,
}: {
  chatOpen: boolean;
  provider?: "codex" | "claude";
  selection: string;
  view: ViewMode;
}) => {
  useEffect(() => {
    document.body.classList.add("doc-workspace-enabled");
    const controls = document.querySelector<HTMLElement>(".doc-view-controls");
    const pagesButton = controls?.querySelector<HTMLButtonElement>(
      '[data-doc-view="pages"]'
    );
    const hasPages =
      document.querySelector("#doc-root [data-doc-page]") !== null;
    const disablePages =
      !hasPages &&
      controls !== null &&
      pagesButton !== undefined &&
      pagesButton !== null;
    if (disablePages) {
      controls.hidden = false;
      pagesButton.disabled = true;
      pagesButton.title = "Add an h2 heading to use pages";
    }
    return () => {
      if (disablePages) {
        controls.hidden = true;
        pagesButton.disabled = false;
        pagesButton.removeAttribute("title");
      }
      document.body.classList.remove("doc-workspace-enabled");
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle(
      "doc-chat-open",
      chatOpen && provider !== undefined
    );
    document.body.classList.toggle(
      "doc-alternate-view",
      view !== "preview" || selection !== "latest"
    );
  }, [chatOpen, provider, selection, view]);
};

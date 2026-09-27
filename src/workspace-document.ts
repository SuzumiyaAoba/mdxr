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
    document.body.classList.add("mdxr-workspace-enabled");
    const controls = document.querySelector<HTMLElement>(".mdxr-view-controls");
    const pagesButton = controls?.querySelector<HTMLButtonElement>(
      '[data-mdxr-view="pages"]'
    );
    const hasPages =
      document.querySelector("#mdxr-root [data-mdxr-page]") !== null;
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
      document.body.classList.remove("mdxr-workspace-enabled");
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle(
      "mdxr-chat-open",
      chatOpen && provider !== undefined
    );
    document.body.classList.toggle(
      "mdxr-alternate-view",
      view !== "preview" || selection !== "latest"
    );
  }, [chatOpen, provider, selection, view]);
};

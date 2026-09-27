import { useSyncExternalStore } from "react";

type WorkspaceTheme = "light" | "dark";

const readTheme = (): WorkspaceTheme =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

const subscribeToTheme = (onChange: () => void): (() => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributeFilter: ["class"],
    attributes: true,
  });
  return () => {
    observer.disconnect();
  };
};

/** Observe the resolved theme, including system changes while in auto mode. */
export const useWorkspaceTheme = (): WorkspaceTheme =>
  useSyncExternalStore(subscribeToTheme, readTheme, () => "light");

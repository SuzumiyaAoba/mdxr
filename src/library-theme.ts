import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
  applyThemeMode,
  cycleThemeMode,
  getThemeMode,
  subscribeToThemeMode,
} from "./client/theme.js";
import type { ThemeMode } from "./client/theme.js";

export interface LibraryTheme {
  cycle: () => void;
  mode: ThemeMode;
}

const getServerThemeMode = (): ThemeMode => "auto";

export const useLibraryTheme = (): LibraryTheme => {
  const mode = useSyncExternalStore(
    subscribeToThemeMode,
    getThemeMode,
    getServerThemeMode
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (): void => {
      applyThemeMode(mode);
    };
    apply();
    if (mode === "auto") {
      media.addEventListener("change", apply);
    }
    return () => {
      media.removeEventListener("change", apply);
    };
  }, [mode]);

  const cycle = useCallback((): void => {
    applyThemeMode(cycleThemeMode());
  }, []);

  return { cycle, mode };
};

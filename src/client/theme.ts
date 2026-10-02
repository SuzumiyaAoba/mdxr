import { readDocumentStorage, removeDocumentStorage } from "./storage.js";

export type ThemeMode = "auto" | "dark" | "light";

const STORAGE_KEY = "doc-theme";
const THEME_CHANGE_EVENT = "doc-theme-change";
const NEXT_THEME_MODE: Record<ThemeMode, ThemeMode> = {
  auto: "light",
  dark: "auto",
  light: "dark",
};

let unsavedThemeMode: ThemeMode | undefined;

const isThemeMode = (
  value: string | null
): value is Exclude<ThemeMode, "auto"> => value === "light" || value === "dark";

const readStoredThemeMode = (): ThemeMode | undefined => {
  try {
    const stored = readDocumentStorage(window.localStorage, STORAGE_KEY);
    return isThemeMode(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
};

export const getThemeMode = (): ThemeMode =>
  unsavedThemeMode ?? readStoredThemeMode() ?? "auto";

export const setThemeMode = (mode: ThemeMode): void => {
  try {
    if (mode === "auto") {
      removeDocumentStorage(window.localStorage, STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
    unsavedThemeMode = undefined;
  } catch {
    // The mode remains active in this page even when storage is unavailable.
    unsavedThemeMode = mode;
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
};

export const cycleThemeMode = (): ThemeMode => {
  const nextMode = NEXT_THEME_MODE[getThemeMode()];
  setThemeMode(nextMode);
  return nextMode;
};

export const applyThemeMode = (
  mode: ThemeMode,
  root: HTMLElement = document.documentElement
): void => {
  const dark =
    mode === "dark" ||
    (mode === "auto" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.docThemeMode = mode;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
};

export const subscribeToThemeMode = (onChange: () => void): (() => void) => {
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== STORAGE_KEY && event.key !== null) {
      return;
    }
    onChange();
  };
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
};

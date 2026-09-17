import { createContext } from "react";

export interface DocContextValue {
  /**
   * Build an editor URL (`vscode://file/…`, per the resolved `editor` setting)
   * for a document-relative path, or undefined when file links are disabled or
   * the file does not exist on disk.
   */
  fileLink?: (relPath: string, line?: string) => string | undefined;
}

/** Render-time document info shared with components. */
export const DocContext = createContext<DocContextValue>({});

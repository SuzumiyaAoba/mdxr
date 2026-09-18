import { createContext } from "react";

export interface DocContextValue {
  /**
   * Build an editor URL (`vscode://file/…`, per the resolved `editor` setting)
   * for a document-relative path, or undefined when file links are disabled or
   * the file does not exist on disk.
   */
  fileLink?: (relPath: string, line?: string) => string | undefined;
  /**
   * The document's render timestamp. Relative-time components (`<Due>`) must
   * read "now" from here: the value is serialized into the hydration payload,
   * so client rendering sees the same instant SSR did — a render crossing
   * midnight can't produce a hydration mismatch.
   */
  now?: Date;
}

/** Render-time document info shared with components. */
export const DocContext = createContext<DocContextValue>({});

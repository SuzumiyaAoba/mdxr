import { nonEmpty } from "./guards.js";

type EditorLink = (absPath: string, line?: string) => string;

/** `scheme://file/{abs}:{line}` — the VS Code URL convention most editors share. */
const atLine =
  (scheme: string): EditorLink =>
  (p, l) =>
    `${scheme}://file${encodeURI(p)}${nonEmpty(l) ? `:${l}` : ""}`;

/** `{scheme}://open?url=file://{abs}&line={n}` — Sublime/TextMate style. */
const queryUrl =
  (scheme: string): EditorLink =>
  (p, l) =>
    `${scheme}://open?url=file://${encodeURI(p)}${nonEmpty(l) ? `&line=${l}` : ""}`;

/** Known editors; unknown names fall back to the `scheme://file` convention. */
export const EDITORS: Record<string, EditorLink> = {
  cursor: atLine("cursor"),
  idea: (p, l) =>
    `idea://open?file=${encodeURI(p)}${nonEmpty(l) ? `&line=${l}` : ""}`,
  sublime: queryUrl("subl"),
  textmate: queryUrl("txmt"),
  vscode: atLine("vscode"),
  "vscode-insiders": atLine("vscode-insiders"),
  windsurf: atLine("windsurf"),
  zed: atLine("zed"),
};

/**
 * Editor URL for an absolute path. `editor` is a known name (see EDITORS),
 * `"none"` (no link), a URL template with `{path}`/`{line}` placeholders
 * (`myed://open?f={path}&l={line}`), or a bare name treated as a
 * `scheme://file` editor. Undefined → vscode.
 */
export const editorUrl = (
  editor: string | undefined,
  absPath: string,
  line?: string
): string | undefined => {
  const e = nonEmpty(editor) ? editor : "vscode";
  if (e === "none") {
    return undefined;
  }
  const known = EDITORS[e];
  if (known !== undefined) {
    return known(absPath, line);
  }
  if (e.includes("{path}")) {
    return e
      .replaceAll("{path}", encodeURI(absPath))
      .replaceAll("{line}", line ?? "");
  }
  return atLine(e)(absPath, line);
};

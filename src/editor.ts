import { nonEmpty, urlScheme } from "./guards.js";

type EditorLink = (absPath: string, line?: string) => string;

/**
 * Path → URI path segment-by-segment. `encodeURI` would leave `#`, `?`,
 * `%`, `&` intact and they parse as delimiters inside the editor URL;
 * `encodeURIComponent` on the whole path would mangle `/`. Backslashes are
 * normalized so Windows paths survive too (`C:\x` → `C%3A/x`).
 */
const encodePath = (p: string): string =>
  p
    .replaceAll("\\", "/")
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");

/** `scheme://file/{abs}:{line}` — the VS Code URL convention most editors share. */
const atLine =
  (scheme: string): EditorLink =>
  (p, l) =>
    `${scheme}://file${encodePath(p)}${nonEmpty(l) ? `:${l}` : ""}`;

/** `{scheme}://open?url=file://{abs}&line={n}` — Sublime/TextMate style. */
const queryUrl =
  (scheme: string): EditorLink =>
  (p, l) =>
    `${scheme}://open?url=file://${encodePath(p)}${nonEmpty(l) ? `&line=${l}` : ""}`;

/** Known editors; unknown names fall back to the `scheme://file` convention. */
export const EDITORS: Record<string, EditorLink> = {
  cursor: atLine("cursor"),
  idea: (p, l) =>
    `idea://open?file=${encodePath(p)}${nonEmpty(l) ? `&line=${l}` : ""}`,
  sublime: queryUrl("subl"),
  textmate: queryUrl("txmt"),
  vscode: atLine("vscode"),
  "vscode-insiders": atLine("vscode-insiders"),
  windsurf: atLine("windsurf"),
  zed: atLine("zed"),
};

/**
 * Schemes that execute script when an `<a href>` is clicked. `editor` is a
 * config value, but frontmatter can also supply it — a document must not be
 * able to mint `javascript:`/`data:` links through file references.
 */
const SCRIPTABLE = new Set(["data", "javascript", "vbscript"]);

const build = (
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
      .replaceAll("{path}", encodePath(absPath))
      .replaceAll("{line}", line ?? "");
  }
  // A bare name becomes a `scheme://file` editor — but only if it could
  // actually be a URI scheme; otherwise the link would be malformed.
  if (!/^[a-z][a-z0-9+.-]*$/iu.test(e)) {
    return undefined;
  }
  return atLine(e)(absPath, line);
};

/**
 * Editor URL for an absolute path. `editor` is a known name (see EDITORS),
 * `"none"` (no link), a URL template with `{path}`/`{line}` placeholders
 * (`myed://open?f={path}&l={line}`), or a bare name treated as a
 * `scheme://file` editor. Undefined → vscode. Scriptable schemes are
 * refused — `editor` can arrive from frontmatter, which is document input.
 */
export const editorUrl = (
  editor: string | undefined,
  absPath: string,
  line?: string
): string | undefined => {
  const url = build(editor, absPath, line);
  if (url === undefined) {
    return undefined;
  }
  const scheme = urlScheme(url);
  return scheme !== undefined && SCRIPTABLE.has(scheme) ? undefined : url;
};

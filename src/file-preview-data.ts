import { asString, isRecord } from "./guards.js";
import { parseSyntaxLines } from "./workspace-syntax.js";
import type { SyntaxLines } from "./workspace-syntax.js";

export type FilePreviewData =
  | { kind: "image"; src: string }
  | { kind: "text"; source: string; syntax: SyntaxLines }
  | {
      kind: "markdown";
      source: string;
      syntax: SyntaxLines;
      html?: string;
      renderError?: string;
    };

/** Keep file contents as text/tokens; rendered MDX is isolated in an iframe. */
export const parseFilePreview = (value: unknown): FilePreviewData => {
  if (!isRecord(value)) {
    throw new Error("Invalid file preview response");
  }
  if (
    value.kind === "image" &&
    typeof value.src === "string" &&
    value.src.startsWith("data:image/")
  ) {
    return { kind: "image", src: value.src };
  }
  const syntax = parseSyntaxLines(value.syntax);
  if (typeof value.source !== "string" || syntax === undefined) {
    throw new Error("Invalid file preview response");
  }
  if (value.kind === "text") {
    return { kind: "text", source: value.source, syntax };
  }
  if (value.kind === "markdown") {
    return {
      html: asString(value.html),
      kind: "markdown",
      renderError: asString(value.renderError),
      source: value.source,
      syntax,
    };
  }
  throw new Error("Invalid file preview response");
};

export const fetchFilePreview = async (
  url: string,
  signal: AbortSignal
): Promise<FilePreviewData> => {
  const theme = document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
  const response = await fetch(`${url}&theme=${theme}`, {
    cache: "no-store",
    signal,
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      isRecord(value) && typeof value.error === "string"
        ? value.error
        : "Unable to load file preview"
    );
  }
  return parseFilePreview(value);
};

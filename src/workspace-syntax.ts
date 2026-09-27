import { isRecord } from "./guards.js";

export interface SyntaxToken {
  text: string;
  style: Record<string, string>;
}

export type SyntaxLines = SyntaxToken[][];

const ALLOWED_STYLE_PROPERTIES = [
  "--shiki-light",
  "--shiki-dark",
  "--shiki-light-font-style",
  "--shiki-dark-font-style",
  "--shiki-light-font-weight",
  "--shiki-dark-font-weight",
  "--shiki-light-text-decoration",
  "--shiki-dark-text-decoration",
] as const;

const parseToken = (value: unknown): SyntaxToken | undefined => {
  if (
    !isRecord(value) ||
    typeof value.text !== "string" ||
    !isRecord(value.style) ||
    Array.isArray(value.style)
  ) {
    return undefined;
  }

  const style: Record<string, string> = {};
  for (const property of ALLOWED_STYLE_PROPERTIES) {
    if (!Object.hasOwn(value.style, property)) {
      continue;
    }
    const propertyValue = value.style[property];
    if (typeof propertyValue === "string") {
      style[property] = propertyValue;
    }
  }
  return { style, text: value.text };
};

/** Validate and narrow syntax tokens received through a workspace API. */
export const parseSyntaxLines = (value: unknown): SyntaxLines | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const lines: SyntaxLines = [];
  for (const lineValue of value) {
    if (!Array.isArray(lineValue)) {
      return undefined;
    }
    const line: SyntaxToken[] = [];
    for (const tokenValue of lineValue) {
      const token = parseToken(tokenValue);
      if (token === undefined) {
        return undefined;
      }
      line.push(token);
    }
    lines.push(line);
  }
  return lines;
};

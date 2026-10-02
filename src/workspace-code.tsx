import type { DiffWordToken } from "./workspace-diff-model.js";
import type { SyntaxToken } from "./workspace-syntax.js";

interface TokenRange<T> {
  end: number;
  start: number;
  token: T;
}

interface WorkspaceCodeProps {
  text: string;
  syntax?: SyntaxToken[];
  words?: DiffWordToken[];
}

const tokenRanges = <T extends { text: string }>(
  tokens: readonly T[] | undefined,
  text: string
): TokenRange<T>[] | null => {
  if (tokens === undefined) {
    return [];
  }

  const ranges: TokenRange<T>[] = [];
  let offset = 0;
  for (const token of tokens) {
    if (!text.startsWith(token.text, offset)) {
      return null;
    }
    const end = offset + token.text.length;
    if (end > offset) {
      ranges.push({ end, start: offset, token });
    }
    offset = end;
  }
  return offset === text.length ? ranges : null;
};

export const WorkspaceCode = ({ text, syntax, words }: WorkspaceCodeProps) => {
  const syntaxRanges = tokenRanges(syntax, text);
  const wordRanges =
    words === undefined || words.length === 0 ? [] : tokenRanges(words, text);

  if (syntaxRanges === null || wordRanges === null) {
    return text;
  }

  const boundaries = new Set([0, text.length]);
  for (const range of syntaxRanges) {
    boundaries.add(range.start);
    boundaries.add(range.end);
  }
  for (const range of wordRanges) {
    boundaries.add(range.start);
    boundaries.add(range.end);
  }

  const offsets = [...boundaries].toSorted((left, right) => left - right);
  if (offsets.length < 2) {
    return text;
  }

  let syntaxIndex = 0;
  let wordIndex = 0;
  return offsets.slice(0, -1).map((start, index) => {
    const end = offsets[index + 1];
    if (end === undefined || end <= start) {
      return null;
    }

    while (
      (syntaxRanges[syntaxIndex]?.end ?? Number.POSITIVE_INFINITY) <= start
    ) {
      syntaxIndex += 1;
    }
    while ((wordRanges[wordIndex]?.end ?? Number.POSITIVE_INFINITY) <= start) {
      wordIndex += 1;
    }

    const syntaxRange = syntaxRanges[syntaxIndex];
    const wordRange = wordRanges[wordIndex];
    const hasSyntax =
      syntaxRange !== undefined &&
      syntaxRange.start <= start &&
      syntaxRange.end >= end;
    const wordKind =
      wordRange !== undefined &&
      wordRange.start <= start &&
      wordRange.end >= end &&
      wordRange.token.kind !== "context"
        ? wordRange.token.kind
        : undefined;
    const chunk = text.slice(start, end);

    if (!hasSyntax && wordKind === undefined) {
      return chunk;
    }

    const className = [
      hasSyntax ? "doc-workspace-syntax" : undefined,
      wordKind === undefined ? undefined : "doc-workspace-diff-word",
    ]
      .filter((value) => value !== undefined)
      .join(" ");

    return (
      <span
        className={className}
        data-kind={wordKind}
        key={`${start}-${end}`}
        style={hasSyntax ? syntaxRange?.token.style : undefined}
      >
        {chunk}
      </span>
    );
  });
};

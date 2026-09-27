export interface DiffLine {
  text: string;
  type: "context" | "add" | "remove";
}

export interface DiffWordToken {
  kind: "context" | "add" | "remove";
  text: string;
}

export interface UnifiedDiffRow {
  key: string;
  newNumber: number | null;
  oldNumber: number | null;
  text: string;
  tokens: DiffWordToken[];
  type: DiffLine["type"];
}

export interface SplitDiffCell {
  kind: DiffLine["type"];
  lineNumber: number;
  text: string;
  tokens: DiffWordToken[];
}

export interface SplitDiffRow {
  key: string;
  newLine: SplitDiffCell | null;
  oldLine: SplitDiffCell | null;
}

const MAX_WORD_DIFF_CHARACTERS = 4096;
const MAX_WORD_DIFF_CELLS = 32_768;

interface Segmenter {
  segment: (input: string) => Iterable<{ segment: string }>;
}

const segmenters = new Map<string, Segmenter>();

const getSegmenter = (locale: string): Segmenter | undefined => {
  if (!("Segmenter" in Intl)) {
    return undefined;
  }
  const cached = segmenters.get(locale);
  if (cached !== undefined) {
    return cached;
  }

  const SegmenterConstructor = (
    Intl as typeof Intl & {
      Segmenter: new (
        locales: string | string[],
        options: { granularity: "word" }
      ) => Segmenter;
    }
  ).Segmenter;
  const segmenter = new SegmenterConstructor(locale, { granularity: "word" });
  segmenters.set(locale, segmenter);
  return segmenter;
};

const localeFor = (value: string): string =>
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value)
    ? "ja"
    : "en";

const tokenizeWords = (value: string): string[] => {
  const segmenter = getSegmenter(localeFor(value));
  if (segmenter !== undefined) {
    return Array.from(segmenter.segment(value), ({ segment }) => segment);
  }
  return value.match(/\P{M}\p{M}*|\p{M}+/gu) ?? [];
};

const pushToken = (
  tokens: DiffWordToken[],
  kind: DiffWordToken["kind"],
  text: string
): void => {
  if (text === "") {
    return;
  }
  const previous = tokens.at(-1);
  if (previous?.kind === kind) {
    previous.text += text;
    return;
  }
  tokens.push({ kind, text });
};

const fallbackTokenDiff = (
  before: string[],
  after: string[]
): { before: DiffWordToken[]; after: DiffWordToken[] } => {
  let prefix = 0;
  while (
    prefix < before.length &&
    prefix < after.length &&
    before[prefix] === after[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - suffix - 1] === after[after.length - suffix - 1]
  ) {
    suffix += 1;
  }

  const beforeTokens: DiffWordToken[] = [];
  const afterTokens: DiffWordToken[] = [];
  pushToken(beforeTokens, "context", before.slice(0, prefix).join(""));
  pushToken(
    beforeTokens,
    "remove",
    before.slice(prefix, before.length - suffix).join("")
  );
  pushToken(
    beforeTokens,
    "context",
    before.slice(before.length - suffix).join("")
  );
  pushToken(afterTokens, "context", after.slice(0, prefix).join(""));
  pushToken(
    afterTokens,
    "add",
    after.slice(prefix, after.length - suffix).join("")
  );
  pushToken(
    afterTokens,
    "context",
    after.slice(after.length - suffix).join("")
  );
  return { after: afterTokens, before: beforeTokens };
};

const createLcsTable = (before: string[], after: string[]): Uint16Array => {
  const width = after.length + 1;
  const lcs = new Uint16Array((before.length + 1) * width);
  for (
    let beforeIndex = before.length - 1;
    beforeIndex >= 0;
    beforeIndex -= 1
  ) {
    const row = beforeIndex * width;
    const nextRow = (beforeIndex + 1) * width;
    for (let afterIndex = after.length - 1; afterIndex >= 0; afterIndex -= 1) {
      lcs[row + afterIndex] =
        before[beforeIndex] === after[afterIndex]
          ? (lcs[nextRow + afterIndex + 1] ?? 0) + 1
          : Math.max(
              lcs[nextRow + afterIndex] ?? 0,
              lcs[row + afterIndex + 1] ?? 0
            );
    }
  }
  return lcs;
};

const shouldRemoveWord = (
  beforeToken: string | undefined,
  afterToken: string | undefined,
  removeScore: number,
  addScore: number
): boolean =>
  beforeToken !== undefined &&
  (afterToken === undefined || removeScore >= addScore);

const diffWordTokens = (
  before: string[],
  after: string[],
  lcs: Uint16Array
): { after: DiffWordToken[]; before: DiffWordToken[] } => {
  const width = after.length + 1;
  const beforeTokens: DiffWordToken[] = [];
  const afterTokens: DiffWordToken[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;
  while (beforeIndex < before.length || afterIndex < after.length) {
    const beforeToken = before[beforeIndex];
    const afterToken = after[afterIndex];
    if (beforeToken !== undefined && beforeToken === afterToken) {
      pushToken(beforeTokens, "context", beforeToken);
      pushToken(afterTokens, "context", afterToken);
      beforeIndex += 1;
      afterIndex += 1;
      continue;
    }

    const removeScore = lcs[(beforeIndex + 1) * width + afterIndex] ?? 0;
    const addScore = lcs[beforeIndex * width + afterIndex + 1] ?? 0;
    if (shouldRemoveWord(beforeToken, afterToken, removeScore, addScore)) {
      pushToken(beforeTokens, "remove", beforeToken);
      beforeIndex += 1;
    } else if (afterToken !== undefined) {
      pushToken(afterTokens, "add", afterToken);
      afterIndex += 1;
    }
  }
  return { after: afterTokens, before: beforeTokens };
};

/** Marks changed words while retaining spaces and punctuation exactly. */
export const createWordDiff = (
  beforeText: string,
  afterText: string
): { after: DiffWordToken[]; before: DiffWordToken[] } => {
  const isLongLine =
    beforeText.length > MAX_WORD_DIFF_CHARACTERS ||
    afterText.length > MAX_WORD_DIFF_CHARACTERS;
  if (isLongLine) {
    return {
      after: [{ kind: "add", text: afterText }],
      before: [{ kind: "remove", text: beforeText }],
    };
  }

  const before = tokenizeWords(beforeText);
  const after = tokenizeWords(afterText);
  const cellCount = (before.length + 1) * (after.length + 1);
  if (cellCount > MAX_WORD_DIFF_CELLS) {
    return fallbackTokenDiff(before, after);
  }
  return diffWordTokens(before, after, createLcsTable(before, after));
};

interface AnnotatedDiffLine extends DiffLine {
  tokens: DiffWordToken[];
}

interface ChangeGroup {
  added: number[];
  end: number;
  removed: number[];
}

const collectChangeGroup = (lines: DiffLine[], start: number): ChangeGroup => {
  const removed: number[] = [];
  const added: number[] = [];
  let end = start;
  while (end < lines.length && lines[end]?.type !== "context") {
    const line = lines[end];
    if (line?.type === "remove") {
      removed.push(end);
    } else if (line?.type === "add") {
      added.push(end);
    }
    end += 1;
  }
  return { added, end, removed };
};

const annotateChangedGroup = (
  annotated: AnnotatedDiffLine[],
  lines: DiffLine[],
  group: ChangeGroup
): void => {
  const pairedCount = Math.min(group.removed.length, group.added.length);
  for (let pairIndex = 0; pairIndex < pairedCount; pairIndex += 1) {
    const removedIndex = group.removed[pairIndex];
    const addedIndex = group.added[pairIndex];
    if (removedIndex === undefined || addedIndex === undefined) {
      continue;
    }
    const beforeLine = lines[removedIndex];
    const afterLine = lines[addedIndex];
    const beforeOutput = annotated[removedIndex];
    const afterOutput = annotated[addedIndex];
    if (
      beforeLine === undefined ||
      afterLine === undefined ||
      beforeOutput === undefined ||
      afterOutput === undefined
    ) {
      continue;
    }
    const wordDiffResult = createWordDiff(beforeLine.text, afterLine.text);
    beforeOutput.tokens = wordDiffResult.before;
    afterOutput.tokens = wordDiffResult.after;
  }

  for (const removedIndex of group.removed.slice(pairedCount)) {
    const line = annotated[removedIndex];
    if (line !== undefined) {
      line.tokens = [{ kind: "remove", text: line.text }];
    }
  }
  for (const addedIndex of group.added.slice(pairedCount)) {
    const line = annotated[addedIndex];
    if (line !== undefined) {
      line.tokens = [{ kind: "add", text: line.text }];
    }
  }
};

const markChangedWords = (
  lines: DiffLine[],
  wordDiff: boolean
): AnnotatedDiffLine[] => {
  const annotated: AnnotatedDiffLine[] = lines.map((line) => ({
    ...line,
    tokens: [],
  }));
  if (!wordDiff) {
    return annotated;
  }

  let index = 0;
  while (index < annotated.length) {
    if (annotated[index]?.type === "context") {
      index += 1;
      continue;
    }

    const group = collectChangeGroup(lines, index);
    annotateChangedGroup(annotated, lines, group);
    index = group.end;
  }
  return annotated;
};

export const createUnifiedDiffRows = (
  lines: DiffLine[],
  wordDiff: boolean
): UnifiedDiffRow[] => {
  const annotated = markChangedWords(lines, wordDiff);
  let oldNumber = 0;
  let newNumber = 0;
  return annotated.map((line, index) => {
    if (line.type !== "add") {
      oldNumber += 1;
    }
    if (line.type !== "remove") {
      newNumber += 1;
    }
    return {
      key: `unified-${index}-${oldNumber}-${newNumber}`,
      newNumber: line.type === "remove" ? null : newNumber,
      oldNumber: line.type === "add" ? null : oldNumber,
      text: line.text,
      tokens: line.tokens,
      type: line.type,
    };
  });
};

interface LineCounters {
  newNumber: number;
  oldNumber: number;
}

interface SplitChangeGroup {
  added: AnnotatedDiffLine[];
  end: number;
  removed: AnnotatedDiffLine[];
}

const collectSplitChangeGroup = (
  lines: AnnotatedDiffLine[],
  start: number,
  counters: LineCounters
): SplitChangeGroup => {
  const removed: AnnotatedDiffLine[] = [];
  const added: AnnotatedDiffLine[] = [];
  let end = start;
  while (end < lines.length && lines[end]?.type !== "context") {
    const line = lines[end];
    if (line?.type === "remove") {
      removed.push(line);
      counters.oldNumber += 1;
    } else if (line?.type === "add") {
      added.push(line);
      counters.newNumber += 1;
    }
    end += 1;
  }
  return { added, end, removed };
};

const toSplitCell = (
  line: AnnotatedDiffLine | undefined,
  lineNumber: number | null
): SplitDiffCell | null => {
  if (line === undefined || lineNumber === null) {
    return null;
  }
  return {
    kind: line.type,
    lineNumber,
    text: line.text,
    tokens: line.tokens,
  };
};

const createChangedSplitRows = (
  group: SplitChangeGroup,
  counters: LineCounters,
  keyOffset: number
): SplitDiffRow[] => {
  const oldStart = counters.oldNumber - group.removed.length + 1;
  const newStart = counters.newNumber - group.added.length + 1;
  const rowCount = Math.max(group.removed.length, group.added.length);
  const rows: SplitDiffRow[] = [];
  for (let index = 0; index < rowCount; index += 1) {
    const oldLine = group.removed[index];
    const newLine = group.added[index];
    const oldLineNumber = oldLine === undefined ? null : oldStart + index;
    const newLineNumber = newLine === undefined ? null : newStart + index;
    rows.push({
      key: `split-${keyOffset + index}`,
      newLine: toSplitCell(newLine, newLineNumber),
      oldLine: toSplitCell(oldLine, oldLineNumber),
    });
  }
  return rows;
};

export const createSplitDiffRows = (
  lines: DiffLine[],
  wordDiff: boolean
): SplitDiffRow[] => {
  const annotated = markChangedWords(lines, wordDiff);
  const counters: LineCounters = { newNumber: 0, oldNumber: 0 };
  const rows: SplitDiffRow[] = [];
  let index = 0;

  while (index < annotated.length) {
    const line = annotated[index];
    if (line === undefined) {
      index += 1;
      continue;
    }
    if (line.type === "context") {
      counters.oldNumber += 1;
      counters.newNumber += 1;
      rows.push({
        key: `split-${rows.length}`,
        newLine: {
          kind: "context",
          lineNumber: counters.newNumber,
          text: line.text,
          tokens: line.tokens,
        },
        oldLine: {
          kind: "context",
          lineNumber: counters.oldNumber,
          text: line.text,
          tokens: line.tokens,
        },
      });
      index += 1;
      continue;
    }

    const group = collectSplitChangeGroup(annotated, index, counters);
    for (const splitRow of createChangedSplitRows(
      group,
      counters,
      rows.length
    )) {
      rows.push(splitRow);
    }
    index = group.end;
  }
  return rows;
};

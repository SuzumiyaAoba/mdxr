/**
 * The Markdown answer-sheet format shared by SSR (`<Ask>`'s seeded output)
 * and the live client (`syncAsk` in doc-events.ts): `# title` followed by
 * one `- **label**: answer` line per question. A single formatter keeps the
 * two emitters byte-identical — the client's rewrite must reproduce what
 * SSR wrote or hydration diffs would flash the pane.
 */

export interface SheetEntry {
  /** The answer text; `""` renders as an unanswered (blank) item. */
  answer: string;
  /** The raw question label — escaping happens here. */
  label: string;
}

// A newline in the label would split the list item — collapse it; `\`/`*`
// are escaped so they can't break the surrounding `**…**` emphasis.
const sheetLabel = (raw: string): string =>
  raw
    .replaceAll(/\s+/gu, " ")
    .trim()
    .replaceAll("\\", "\\\\")
    .replaceAll("*", "\\*");

const sheetTitle = (raw: string | undefined): string => {
  const t = (raw ?? "Answers").replaceAll(/\s+/gu, " ").trim();
  return t === "" ? "Answers" : t;
};

/** `# title` + `- **label**: answer` lines; multi-line answers indent. */
export const formatAnswerSheet = (
  title: string | undefined,
  entries: readonly SheetEntry[]
): string => {
  const lines = entries.map(({ answer, label }) => {
    const a = answer.replaceAll("\n", "\n  ");
    return `- **${sheetLabel(label)}**:${a === "" ? "" : ` ${a}`}`;
  });
  return `# ${sheetTitle(title)}\n\n${lines.length === 0 ? "(no questions)" : lines.join("\n")}`;
};

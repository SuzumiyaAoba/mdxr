export const formatError = (err: unknown): string => {
  if (err instanceof Error) {
    // vfile-style messages carry line/column for agent self-repair.
    const e = err as Error & { line?: number; column?: number; file?: string };
    const loc =
      e.line === null || e.line === undefined
        ? ""
        : `:${e.line}:${e.column ?? 0}`;
    const file = e.file ?? "";
    return `${file}${loc} ${e.message}`.trim();
  }
  return String(err);
};

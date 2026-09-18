/**
 * Validate the `--format` flag: omitted and "text" mean human-readable
 * errors, "json" switches failure output to a machine-readable object.
 */
export const parseErrorFormat = (format?: string): "text" | "json" => {
  if (format === undefined || format === "text") {
    return "text";
  }
  if (format === "json") {
    return "json";
  }
  throw new Error(`invalid --format "${format}" (expected text|json)`);
};

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

const levenshtein = (a: string, b: string): number => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array.from({ length: b.length }, () => 0),
  ]);
  for (let j = 1; j <= b.length; j += 1) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
};

/**
 * MDX's "Expected component `<X>`" errors get a friendlier message: the
 * closest catalog name (edit distance ≤ 3) plus the full list, so the agent
 * can self-correct without a `mdxr catalog` round-trip.
 */
export const enhanceRenderError = (
  err: unknown,
  componentNames: string[]
): unknown => {
  if (!(err instanceof Error)) {
    return err;
  }
  const m = /Expected component [`"'](?<name>\w+)[`"']/u.exec(err.message);
  const name = m?.groups?.name;
  if (name === undefined) {
    return err;
  }
  const names = componentNames.filter((n) => /^[A-Z]/u.test(n));
  const [nearest] = names
    .map((n) => ({ d: levenshtein(name.toLowerCase(), n.toLowerCase()), n }))
    .toSorted((x, y) => x.d - y.d);
  const hint =
    nearest !== undefined && nearest.d <= 3
      ? ` Did you mean <${nearest.n}>?`
      : "";
  return new Error(
    `Unknown component <${name}>.${hint} Available: ${names.join(", ")}. Add custom components via mdxr.config.ts.`,
    { cause: err }
  );
};

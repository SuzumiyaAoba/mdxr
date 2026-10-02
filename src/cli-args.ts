/** CAC treats a separate `-` as an option, so bind stdout output values explicitly. */
export const normalizeOutputArgs = (args: string[]): string[] => {
  const normalized: string[] = [];
  let literal = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }
    if (argument === "--") {
      literal = true;
    }
    if (
      !literal &&
      (argument === "--out" || argument === "-o") &&
      args[index + 1] === "-"
    ) {
      normalized.push("--out=-");
      index += 1;
    } else {
      normalized.push(argument);
    }
  }
  return normalized;
};

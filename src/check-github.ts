import path from "node:path";

import type { DocumentDiagnostic } from "./check-diagnostics.js";

const escapeData = (value: string): string =>
  value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
const escapeProperty = (value: string): string =>
  escapeData(value).replaceAll(":", "%3A").replaceAll(",", "%2C");

export const formatGithubDiagnostic = (
  diagnostic: DocumentDiagnostic
): string => {
  const file = path.isAbsolute(diagnostic.file)
    ? path.relative(process.cwd(), diagnostic.file)
    : diagnostic.file;
  const message =
    diagnostic.suggestion === undefined
      ? diagnostic.message
      : `${diagnostic.message} Did you mean ${diagnostic.suggestion}?`;
  return `::${diagnostic.severity} file=${escapeProperty(file)},line=${diagnostic.line},col=${diagnostic.column},title=${escapeProperty(diagnostic.code)}::${escapeData(message)}`;
};

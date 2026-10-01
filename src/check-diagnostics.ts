import type { Node } from "unist";

import { isRecord } from "./guards.js";

export interface DocumentDiagnostic {
  file: string;
  line: number;
  column: number;
  code: string;
  severity: "error" | "warning";
  message: string;
  suggestion?: string;
}

export const diagnosticAt = (
  file: string,
  node: Node | undefined,
  code: string,
  message: string,
  severity: DocumentDiagnostic["severity"] = "error",
  suggestion?: string
): DocumentDiagnostic => ({
  code,
  column: node?.position?.start.column ?? 1,
  file: node?.data?.mdxrSourceFile ?? file,
  line: node?.position?.start.line ?? 1,
  message,
  severity,
  ...(suggestion === undefined ? {} : { suggestion }),
});

export const errorDiagnostic = (
  file: string,
  error: unknown,
  code: string
): DocumentDiagnostic => ({
  code,
  column:
    isRecord(error) && typeof error.column === "number" ? error.column : 1,
  file:
    isRecord(error) && typeof error.file === "string" && error.file !== ""
      ? error.file
      : file,
  line: isRecord(error) && typeof error.line === "number" ? error.line : 1,
  message: error instanceof Error ? error.message : String(error),
  severity: "error",
});

export const formatDiagnostic = (diagnostic: DocumentDiagnostic): string =>
  `${diagnostic.file}:${diagnostic.line}:${diagnostic.column} ${diagnostic.severity} [${diagnostic.code}] ${diagnostic.message}${diagnostic.suggestion === undefined ? "" : ` Did you mean ${diagnostic.suggestion}?`}`;

/** Node.js validation API. Static checks never execute project configuration. */
export { checkDocument, checkDocuments, checkResult } from "./check.js";
export type { CheckOptions, CheckResult } from "./check.js";
export { formatDiagnostic } from "./check-diagnostics.js";
export type { DocumentDiagnostic } from "./check-diagnostics.js";
export { findConfig } from "./config.js";
export type { ConfigOptions } from "./config.js";
export { watchDocuments } from "./check-watch.js";
export { formatGithubDiagnostic } from "./check-github.js";

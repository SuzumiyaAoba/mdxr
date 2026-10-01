import type { Dirent } from "node:fs";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { errorDiagnostic } from "./check-diagnostics.js";
import type { DocumentDiagnostic } from "./check-diagnostics.js";
import { checkSource } from "./check-source.js";
import { loadConfig } from "./config.js";
import type { ConfigOptions } from "./config.js";
import { loadUserComponents, render } from "./render.js";
import { builtinComponents } from "./ui/index.js";

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".mdxr-cache",
  "dist",
  "node_modules",
  "storybook-static",
]);
const DOCUMENT_EXTENSIONS = new Set([".md", ".markdown", ".mdx"]);

export interface CheckOptions extends ConfigOptions {
  onDependencies?: (paths: string[]) => void;
  /** Load component contracts without performing a second render (preview use). */
  projectComponents?: boolean;
  render?: boolean;
  strict?: boolean;
}

export interface CheckResult {
  ok: boolean;
  files: string[];
  diagnostics: DocumentDiagnostic[];
  errors: number;
  warnings: number;
}

export const checkResult = (
  files: string[],
  diagnostics: DocumentDiagnostic[],
  strict = false
): CheckResult => {
  const errors = diagnostics.filter(
    ({ severity }) => severity === "error"
  ).length;
  const warnings = diagnostics.length - errors;
  return {
    diagnostics,
    errors,
    files,
    ok: errors === 0 && (!strict || warnings === 0),
    warnings,
  };
};

export const checkDocument = async (
  source: string,
  filePath: string,
  options: CheckOptions = {}
): Promise<DocumentDiagnostic[]> => {
  try {
    const dir = path.dirname(path.resolve(filePath));
    let project;
    if (options.render === true || options.projectComponents === true) {
      const config = await loadConfig(dir, options);
      project = await loadUserComponents(config);
      options.onDependencies?.([
        ...(config.dependencies ?? []),
        ...(project.dependencies ?? []),
      ]);
    }
    const diagnostics = checkSource(
      source,
      filePath,
      {
        ...builtinComponents,
        ...project?.components,
      },
      options.onDependencies
    );
    if (
      options.render === true &&
      !diagnostics.some(({ severity }) => severity === "error")
    ) {
      try {
        await render(source, { ...options, dir, filePath, hydrate: false });
      } catch (error) {
        diagnostics.push(errorDiagnostic(filePath, error, "mdxr:render"));
      }
    }
    return diagnostics;
  } catch (error) {
    return [errorDiagnostic(filePath, error, "mdxr:config")];
  }
};

const shouldCheckEntry = (entry: Dirent, parent: string): boolean => {
  if (entry.isSymbolicLink()) {
    return false;
  }
  if (entry.isDirectory()) {
    const history =
      entry.name === "history" && path.basename(parent) === ".mdxr";
    return !EXCLUDED_DIRECTORIES.has(entry.name) && !history;
  }
  return (
    entry.isFile() &&
    DOCUMENT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
  );
};

const collectFiles = async (
  target: string,
  files: string[],
  diagnostics: DocumentDiagnostic[]
): Promise<void> => {
  try {
    const stats = await lstat(target);
    if (stats.isSymbolicLink()) {
      return;
    }
    if (stats.isFile()) {
      if (DOCUMENT_EXTENSIONS.has(path.extname(target).toLowerCase())) {
        files.push(target);
      } else {
        throw new Error("Expected a .md, .markdown or .mdx document");
      }
      return;
    }
    if (!stats.isDirectory()) {
      throw new Error("Expected a document or a directory");
    }
    const directoryEntries = await readdir(target, { withFileTypes: true });
    const entries = directoryEntries.toSorted((left, right) =>
      left.name.localeCompare(right.name, "en")
    );
    for (const entry of entries) {
      if (shouldCheckEntry(entry, target)) {
        // Keep traversal and diagnostic order deterministic across platforms.
        // oxlint-disable-next-line no-await-in-loop
        await collectFiles(path.join(target, entry.name), files, diagnostics);
      }
    }
  } catch (error) {
    diagnostics.push(errorDiagnostic(target, error, "mdxr:read"));
  }
};

/** Check every document even when earlier files contain syntax or read errors. */
export const checkDocuments = async (
  input = ".mdxr",
  options: CheckOptions = {}
): Promise<CheckResult> => {
  const files: string[] = [];
  const diagnostics: DocumentDiagnostic[] = [];
  await collectFiles(path.resolve(input), files, diagnostics);
  for (const file of files) {
    try {
      // Rendering shares process-local component state and must remain sequential.
      // oxlint-disable-next-line no-await-in-loop
      const source = await readFile(file, "utf-8");
      // oxlint-disable-next-line no-await-in-loop
      diagnostics.push(...(await checkDocument(source, file, options)));
    } catch (error) {
      diagnostics.push(errorDiagnostic(file, error, "mdxr:read"));
    }
  }
  return checkResult(files, diagnostics, options.strict);
};

import { isOneOf } from "./guards.js";

export const WORKSPACE_EXPORT_MODES = [
  "document",
  "review",
  "workspace",
] as const;

export type WorkspaceExportMode = (typeof WORKSPACE_EXPORT_MODES)[number];

export const isWorkspaceExportMode = isOneOf(WORKSPACE_EXPORT_MODES);

export const parseWorkspaceExportMode = (
  value: string | null
): WorkspaceExportMode => {
  if (value === null) {
    return "workspace";
  }
  if (!isWorkspaceExportMode(value)) {
    throw new Error(`Invalid export mode: ${value}`);
  }
  return value;
};

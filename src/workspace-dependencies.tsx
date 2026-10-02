import { Dialog } from "@base-ui/react/dialog";
import { Layers } from "lucide-react";
import { useEffect, useState } from "react";

import type { DependencyChange } from "./dependency-history.js";
import { isRecord } from "./guards.js";

const isDependencyChange = (value: unknown): value is DependencyChange =>
  isRecord(value) &&
  typeof value.path === "string" &&
  (value.hash === null || typeof value.hash === "string") &&
  (value.capturedHash === null || typeof value.capturedHash === "string") &&
  typeof value.size === "number" &&
  ["unchanged", "changed", "missing", "added"].includes(String(value.status));
interface DependencyManifest {
  capturedAt: string;
  changes: DependencyChange[];
}
const readDependencies = async (id: string): Promise<DependencyManifest> => {
  const response = await fetch(
    `/__doc_history?view=dependencies&id=${encodeURIComponent(id)}`,
    { cache: "no-store" }
  );
  const value: unknown = await response.json();
  if (
    !response.ok ||
    !isRecord(value) ||
    typeof value.capturedAt !== "string" ||
    !Array.isArray(value.changes) ||
    !value.changes.every(isDependencyChange)
  ) {
    throw new Error("Dependency manifest is unavailable");
  }
  return { capturedAt: value.capturedAt, changes: value.changes };
};

export const WorkspaceDependencies = ({ id }: { id?: string }) => {
  const [manifest, setManifest] = useState<DependencyManifest>();
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      if (id === undefined || !open) {
        return;
      }
      try {
        const next = await readDependencies(id);
        if (active) {
          setManifest(next);
          setLoadError("");
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [id, open]);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="doc-workspace-export"
        aria-label="Dependency manifest"
        title="Dependency manifest"
      >
        <Layers aria-hidden="true" size={15} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="doc-workspace-export-backdrop" />
        <Dialog.Popup className="doc-workspace-export-dialog doc-workspace-dependencies">
          <Dialog.Title>
            Dependency manifest ({manifest?.changes.length ?? 0})
          </Dialog.Title>
          <Dialog.Description>
            Hashes describe dependencies when this version was saved. Historical
            previews read current dependency files.
          </Dialog.Description>
          {loadError !== "" && <p role="alert">{loadError}</p>}
          {manifest !== undefined && (
            <p>
              Captured:{" "}
              <time dateTime={manifest.capturedAt}>{manifest.capturedAt}</time>
            </p>
          )}
          <ul>
            {manifest?.changes.map((dependency) => (
              <li key={dependency.path}>
                <strong>{dependency.status}</strong> {dependency.path} (
                {dependency.size} current bytes)
                <code>{dependency.capturedHash ?? "missing at capture"}</code>
              </li>
            ))}
          </ul>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

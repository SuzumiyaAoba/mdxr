/** Runtime type guards shared across AST/config/module boundaries. */

import type { AnyComponent } from "./define.js";

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

export const isComponent = (v: unknown): v is AnyComponent =>
  typeof v === "function";

/** Treat "" as absent — document attributes arrive as strings. */
export const nonEmpty = (v: unknown): v is string =>
  typeof v === "string" && v !== "";

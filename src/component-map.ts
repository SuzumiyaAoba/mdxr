import type { ComponentMap } from "./define.js";
import { isComponent, isRecord } from "./guards.js";

/** A default-exported object is treated as a `{ Name: Component }` map. */
const mergeDefaultMap = (val: unknown, into: ComponentMap): void => {
  if (!isRecord(val)) {
    return;
  }
  for (const [k, v] of Object.entries(val)) {
    if (isComponent(v)) {
      into[k] = v;
    }
  }
};

/**
 * Merge a user module's exports into a ComponentMap. A default-exported
 * object is treated as a `{ Name: Component }` map; PascalCase named exports
 * that are functions count directly. Shared by the SSR loader (render.ts)
 * and the hydration bundle (hydrate-runtime.ts) — node-free on purpose.
 */
export const mergeUserComponents = (
  mod: Record<string, unknown>,
  into: ComponentMap = {}
): ComponentMap => {
  for (const [key, val] of Object.entries(mod)) {
    if (key === "default") {
      mergeDefaultMap(val, into);
    } else if (isComponent(val) && /^[A-Z]/u.test(key)) {
      into[key] = val;
    }
  }
  return into;
};

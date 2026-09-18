import type { ComponentMap, MdxrComponent } from "./define.js";
import { isComponent, isRecord } from "./guards.js";

/**
 * `into[k] = v` with `k === "__proto__"` would silently replace the map's
 * prototype instead of registering the component — define it as data.
 */
const put = (into: ComponentMap, k: string, v: MdxrComponent): void => {
  Object.defineProperty(into, k, {
    configurable: true,
    enumerable: true,
    value: v,
    writable: true,
  });
};

/** A default-exported object is treated as a `{ Name: Component }` map. */
const mergeDefaultMap = (val: unknown, into: ComponentMap): void => {
  if (!isRecord(val)) {
    return;
  }
  for (const [k, v] of Object.entries(val)) {
    if (isComponent(v)) {
      put(into, k, v);
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
      put(into, key, val);
    }
  }
  return into;
};

/**
 * Client-side mount for hydrated documents. Bundled into the generated
 * hydration entry by `buildHydrateScript` — keeping this as a real module
 * means TypeScript checks the vnode wiring and the component-merge rules are
 * literally shared with the SSR path (component-map.ts).
 */

import { createElement, Fragment } from "react";
import { hydrateRoot } from "react-dom/client";

import { mergeUserComponents } from "./component-map.js";
import type { AnyComponent, ComponentMap } from "./define.js";
import { DocContext } from "./doc-context.js";

export interface MountSpec {
  /** Catalog components assembled by the generated entry. */
  components: ComponentMap;
  /** The compiled MDX module's default export. */
  doc: AnyComponent;
  /** `fileLink(rel, line)` results recorded during SSR (`rel\0line` → url). */
  fileLinks: Record<string, string>;
  /** PlanHeader props, present iff the document header was rendered. */
  headerProps?: Record<string, string | undefined>;
  /** SSR render timestamp (ISO) — replayed into `DocContext.now`. */
  now?: string;
  /** The PlanHeader component — only bound when `headerProps` is set. */
  planHeader?: AnyComponent;
  /** The user's components module namespace, when configured. */
  userModule?: Record<string, unknown>;
}

/**
 * Rebuild the exact vnode tree SSR produced — `DocContext.Provider` wrapping
 * the Plan header + the compiled MDX module — and `hydrateRoot` it onto
 * `<main id="mdxr-root">`. `fileLink` is replayed from the recorded SSR
 * answers, so components see identical data without filesystem access.
 */
export const mountDocument = (spec: MountSpec): void => {
  if (spec.userModule !== undefined) {
    mergeUserComponents(spec.userModule, spec.components);
  }
  const root = document.querySelector("#mdxr-root");
  if (root === null) {
    return;
  }
  hydrateRoot(
    root,
    createElement(
      DocContext.Provider,
      {
        value: {
          fileLink: (rel: string, line?: string) =>
            spec.fileLinks[`${rel}\0${line ?? ""}`],
          now: spec.now === undefined ? undefined : new Date(spec.now),
        },
      },
      createElement(
        Fragment,
        null,
        spec.headerProps === undefined || spec.planHeader === undefined
          ? null
          : createElement(spec.planHeader, spec.headerProps),
        createElement(spec.doc, { components: spec.components })
      )
    )
  );
};

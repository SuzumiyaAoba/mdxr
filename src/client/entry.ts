import { handleDocEvent } from "./doc-events.js";

/**
 * Document entry point — bundled to an IIFE by `client-js.ts` and inlined
 * into every rendered page. Registers the delegated handler, then seeds
 * each Ask output pane (default-checked fields count as answers) by
 * bubbling a synthetic `input` event off the block — the handler's own
 * input branch does the render, so no serialization code is duplicated.
 */
document.addEventListener("click", handleDocEvent);
document.addEventListener("input", handleDocEvent);
document.addEventListener("change", handleDocEvent);
for (const b of document.querySelectorAll("[data-ask]")) {
  b.dispatchEvent(new Event("input", { bubbles: true }));
}

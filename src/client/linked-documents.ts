import { isRecord } from "../guards.js";

const escapeAttribute = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");

/**
 * Each link opens a bundled standalone render. Blob URLs keep the document
 * portable without publishing sibling files or relying on a preview server.
 * Resolve resources against the source document's directory, including links
 * opened from another bundled document.
 */
export const initLinkedDocuments = (): void => {
  const payload = document.querySelector("#doc-linked-documents");
  if (payload === null) {
    return;
  }
  let documents: unknown;
  try {
    documents = JSON.parse(payload.textContent ?? "{}");
  } catch {
    return;
  }
  if (!isRecord(documents)) {
    return;
  }
  const entries = documents;
  const urls = new Map<string, string>();
  const activate = (event: MouseEvent): void => {
    if (event.defaultPrevented || !(event.target instanceof Element)) {
      return;
    }
    const anchor = event.target.closest<HTMLAnchorElement>(
      "a[data-doc-document]"
    );
    const id = anchor?.dataset.docDocument;
    if (
      anchor === null ||
      anchor === undefined ||
      id === undefined ||
      !Object.hasOwn(entries, id)
    ) {
      return;
    }
    let url = urls.get(id);
    if (url === undefined) {
      const entry: unknown = entries[id];
      if (
        !isRecord(entry) ||
        typeof entry.html !== "string" ||
        typeof entry.path !== "string"
      ) {
        return;
      }
      const base = URL.canParse(entry.path, document.baseURI)
        ? new URL(entry.path, document.baseURI).href
        : undefined;
      const html =
        base === undefined
          ? entry.html
          : entry.html.replace(
              "<head>",
              `<head><base href="${escapeAttribute(base)}" data-doc-document-base>`
            );
      url = URL.createObjectURL(
        new Blob([html], { type: "text/html;charset=utf-8" })
      );
      urls.set(id, url);
    }
    anchor.href = url;
  };
  // Native anchor activation covers mouse, Enter, and modifier/middle clicks.
  // Setting href at activation also leaves the initial hydration markup intact.
  document.addEventListener("click", activate);
  document.addEventListener("auxclick", activate);
  document.addEventListener("contextmenu", activate);
};

/** A resource base must not send fragment links back to the raw MDX file. */
export const initLinkedDocumentAnchors = (): void => {
  if (document.querySelector("base[data-doc-document-base]") === null) {
    return;
  }
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || !(event.target instanceof Element)) {
      return;
    }
    const anchor = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
    const hash = anchor?.getAttribute("href");
    if (hash === undefined || hash === null || anchor?.target === "_blank") {
      return;
    }
    event.preventDefault();
    const previousUrl = window.location.href;
    const nextUrl = new URL(previousUrl);
    nextUrl.hash = hash;
    try {
      // Fragment navigation through Location can silently fail for blob:null
      // documents opened from file://. An absolute history URL also ignores
      // the resource base, while the event reveals targets in paged view.
      if (nextUrl.href !== previousUrl) {
        window.history.pushState(null, "", nextUrl.href);
        window.dispatchEvent(
          new HashChangeEvent("hashchange", {
            newURL: nextUrl.href,
            oldURL: previousUrl,
          })
        );
      }
    } catch {
      // Scrolling still works in previews that disallow history updates.
    }
    if (hash === "#") {
      window.scrollTo(0, 0);
      return;
    }
    let id = hash.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      // A literal percent sign can be part of an authored fragment id.
    }
    document.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView();
  });
};

import { isRecord } from "../guards.js";

const isLinkedEntry = (
  value: unknown
): value is { html: string; path: string } =>
  isRecord(value) &&
  typeof value.html === "string" &&
  typeof value.path === "string";

const linkedEntries = (
  page: Document
): Record<string, { html: string; path: string }> => {
  const raw = page.querySelector("#doc-linked-documents")?.textContent;
  if (raw === undefined || raw === null) {
    return {};
  }
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value)) {
    throw new Error("Invalid related document data");
  }
  const entries: Record<string, { html: string; path: string }> = {};
  for (const [id, entry] of Object.entries(value)) {
    if (!isLinkedEntry(entry)) {
      throw new Error("Invalid related document data");
    }
    entries[id] = entry;
  }
  return entries;
};

const REFERENCE_ATTRIBUTES = [
  "href",
  "xlink:href",
  "for",
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "fill",
  "stroke",
  "clip-path",
  "mask",
  "filter",
  "style",
];
const rewriteReference = (
  value: string,
  attr: string,
  ids: Map<string, string>
): string => {
  let next = value;
  for (const [id, replacement] of ids) {
    if (next === `#${id}`) {
      next = `#${replacement}`;
    } else if (
      ["for", "aria-labelledby", "aria-describedby", "aria-controls"].includes(
        attr
      )
    ) {
      next = next
        .split(" ")
        .map((part) => (part === id ? replacement : part))
        .join(" ");
    }
    next = next.replaceAll(`url(#${id})`, `url(#${replacement})`);
  }
  return next;
};
const rewriteReferences = (
  element: Element,
  ids: Map<string, string>
): void => {
  for (const attr of REFERENCE_ATTRIBUTES) {
    const value = element.getAttribute(attr);
    if (value !== null) {
      element.setAttribute(attr, rewriteReference(value, attr, ids));
    }
  }
};
const rewriteLinks = (
  root: Element,
  destinations: Map<string, string>
): void => {
  for (const anchor of root.querySelectorAll<HTMLAnchorElement>(
    "a[data-doc-document]"
  )) {
    const destination = destinations.get(anchor.dataset.docDocument ?? "");
    if (destination === undefined) {
      throw new Error("A related document could not be resolved");
    }
    anchor.setAttribute("href", `#${destination}`);
    anchor.removeAttribute("target");
    delete anchor.dataset.docDocument;
  }
};
const createRelatedSection = (
  body: Element,
  page: Document,
  destination: string,
  sourcePath: string,
  clone: (node: Node) => Node
): { section: HTMLElement; child: Element } => {
  const section = document.createElement("section");
  section.id = destination;
  section.dataset.docRelated = sourcePath;
  const heading = document.createElement("h2");
  heading.textContent = page.title || sourcePath;
  const child = clone(body);
  if (!(child instanceof Element)) {
    throw new Error("Could not snapshot related content");
  }
  section.append(heading, child);
  for (const style of page.querySelectorAll("style,link[rel=stylesheet]")) {
    section.prepend(clone(style));
  }
  return { child, section };
};
const namespaceStyles = (section: Element, destination: string): void => {
  for (const style of section.querySelectorAll("style")) {
    style.textContent = (style.textContent ?? "").replaceAll(
      "#doc-root",
      `#${destination}-doc-root`
    );
  }
};

/** Namespace fragment, SVG and accessibility references in appended documents. */
const namespaceIds = (root: Element, prefix: string): void => {
  const ids = new Map<string, string>();
  for (const element of [root, ...root.querySelectorAll("[id]")]) {
    if (element.id !== "") {
      ids.set(element.id, `${prefix}-${element.id}`);
      element.id = `${prefix}-${element.id}`;
    }
  }
  for (const element of [root, ...root.querySelectorAll("*")]) {
    rewriteReferences(element, ids);
  }
};

/** Resolve from embedded source data, even if live links already point to blob URLs. */
export const appendRelatedSnapshots = async (
  snapshot: Element,
  container: HTMLElement,
  clone: (node: Node) => Node,
  embed: (root: ParentNode, base?: string) => Promise<void>
): Promise<void> => {
  const seen = new Map<string, string>();
  const sections: HTMLElement[] = [];
  const visit = async (
    root: Element,
    page: Document,
    base: string
  ): Promise<void> => {
    const entries = linkedEntries(page);
    const destinations = new Map<string, string>();
    for (const [id, entry] of Object.entries(entries)) {
      const parsed = new DOMParser().parseFromString(entry.html, "text/html");
      const body = parsed.querySelector("#doc-root");
      if (body === null) {
        throw new Error(`Related document has no content: ${entry.path}`);
      }
      const childBase = new URL(entry.path, base).href;
      const identity = `${childBase}:${parsed.querySelector("#doc-annotation-document")?.textContent ?? body.innerHTML}`;
      let destination = seen.get(identity);
      if (destination === undefined) {
        destination = `doc-related-${seen.size + 1}`;
        seen.set(identity, destination);
        const { section, child } = createRelatedSection(
          body,
          parsed,
          destination,
          entry.path,
          clone
        );
        sections.push(section);
        // oxlint-disable-next-line no-await-in-loop
        await visit(child, parsed, childBase);
        namespaceIds(child, destination);
        namespaceStyles(section, destination);
        // oxlint-disable-next-line no-await-in-loop
        await embed(section, childBase);
      }
      destinations.set(id, destination);
    }
    rewriteLinks(root, destinations);
  };
  await visit(snapshot, document, document.baseURI);
  for (const section of sections) {
    container.append(section);
  }
};

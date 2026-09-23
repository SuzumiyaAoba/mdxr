/**
 * Client-side mount for the page-level sidebar ToC. Called from the hydration
 * bundle when the document has one, or from the standalone ToC bundle
 * (`page-toc-js.ts`) when nothing else hydrates.
 */

import { createElement } from "react";
import { hydrateRoot } from "react-dom/client";

import type { DocHeading } from "./remark/headings.js";
import { PAGE_TOC_DATA_ID, PAGE_TOC_ID, PageToc } from "./ui/page-toc.js";

export const mountPageToc = (): void => {
  const root = document.querySelector(`#${PAGE_TOC_ID}`);
  const data = document.querySelector(`#${PAGE_TOC_DATA_ID}`)?.textContent;
  if (root === null || data === undefined || data === null) {
    return;
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the island is written by htmlDocument from the same DocHeading[]
  const headings = JSON.parse(data) as DocHeading[];
  hydrateRoot(root, createElement(PageToc, { headings }));
};

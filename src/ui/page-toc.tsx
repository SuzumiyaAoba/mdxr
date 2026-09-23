import { useMemo } from "react";

import { PageTOC, PageTOCItems, TOCProvider } from "../components/ui/toc.js";
import type { DocHeading } from "../remark/headings.js";

/** `<aside>` holding the sidebar and the JSON island with its headings. */
export const PAGE_TOC_ID = "mdxr-page-toc";
export const PAGE_TOC_DATA_ID = "mdxr-page-toc-data";

/** Heading levels listed in the sidebar (h2–h3, like `:::toc`). */
const MIN_DEPTH = 2;
const MAX_DEPTH = 3;
/** A single entry isn't worth a sidebar. */
const MIN_ENTRIES = 2;

/** The headings the sidebar lists — empty when the page gets no sidebar. */
export const pageTocHeadings = (headings: DocHeading[]): DocHeading[] => {
  const items = headings.filter(
    (h) => h.depth >= MIN_DEPTH && h.depth <= MAX_DEPTH
  );
  return items.length < MIN_ENTRIES ? [] : items;
};

export interface PageTocProps {
  headings: DocHeading[];
}

/**
 * Page-level "On this page" sidebar built on the Crux UI ToC: a clerk-style
 * outline whose thumb follows the headings currently on screen. Rendered next
 * to `<main>` by `htmlDocument` (not part of the MDX tree) and hydrated by its
 * own root, so it works with or without the document hydration bundle.
 */
export const PageToc = ({ headings }: PageTocProps) => {
  const toc = useMemo(
    () =>
      headings.map((h) => ({
        depth: h.depth,
        title: h.text,
        url: `#${h.slug}`,
      })),
    [headings]
  );
  return (
    <TOCProvider toc={toc}>
      <PageTOC className="min-h-0">
        <p className="text-muted-foreground m-0 text-xs font-semibold">
          On this page
        </p>
        <PageTOCItems variant="clerk" />
      </PageTOC>
    </TOCProvider>
  );
};

import { useContext } from "react";

import { DocContext } from "../doc-context.js";
import { firstLine } from "../editor.js";
import { nonEmpty } from "../guards.js";

/**
 * Resolve a component's `href` override or doc-relative `path`/`lines` to a
 * link target. Explicit `href` always wins; without a render-time fileLink
 * (e.g. Storybook) the component renders unlinked.
 */
export const useFileLink = (
  relPath: string | undefined,
  lines?: string,
  href?: string
): string | undefined => {
  const { fileLink } = useContext(DocContext);
  if (nonEmpty(href)) {
    return href;
  }
  if (!nonEmpty(relPath) || fileLink === undefined) {
    return undefined;
  }
  return fileLink(relPath, firstLine(lines));
};

/** `target`/`rel` for web URLs; editor schemes stay in the same tab. */
export const linkTarget = (href: string): Record<string, string> =>
  /^https?:/u.test(href)
    ? { rel: "noopener noreferrer", target: "_blank" }
    : {};

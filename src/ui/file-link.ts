import { useContext } from "react";

import { DocContext } from "../doc-context.js";
import { nonEmpty, safeHref } from "../guards.js";
import { firstLine } from "../lines.js";

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
  const override = safeHref(href);
  if (override !== undefined) {
    return override;
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

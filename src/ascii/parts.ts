/** Row/caption helpers shared across the ASCII component renderers. */

import type { ListItem, PhrasingContent, RootContent } from "mdast";

import { nonEmpty } from "../guards.js";
import { attr, item, para, strong, txt } from "./ast.js";
import type { MdxTarget } from "./ast.js";
import { statusIcon } from "./glyphs.js";

/** ` — a · b · c` phrasing suffix joining the defined parts. */
export const suffix = (parts: (string | undefined)[]): PhrasingContent[] => {
  const s = parts.filter(nonEmpty).join(" · ");
  return s === "" ? [] : [txt(` — ${s}`)];
};

/** Bare `a · b · c` joining (no leading separator). */
export const joined = (parts: (string | undefined)[]): string =>
  parts.filter(nonEmpty).join(" · ");

/**
 * `**Title — extra**` caption paragraph, emitted only when something is
 * there. A title-less caption drops a leading ` — `/space so `extra` alone
 * still reads cleanly.
 */
export const caption = (
  title: string | undefined,
  extra = ""
): RootContent[] => {
  const label = `${title ?? ""}${extra}`.replace(/^\s*—\s*/u, "").trim();
  return label === "" ? [] : [para([strong([txt(label)])])];
};

/**
 * Glyph-headed list item: `✓`/`◐`/`○`/`✗` prefixes from `statusIcon`.
 * Real checkboxes would be nicer but mdast `checked` only covers
 * done/todo — the four-state glyph stays readable for doing/blocked.
 */
export const statusItem = (
  status: string | undefined,
  head: PhrasingContent[],
  children: RootContent[]
): ListItem =>
  item([para([txt(`${statusIcon(status)} `), ...head]), ...children]);

/** `key` tally over elements → ` — 2 critical · 1 high` (or ""). */
export const tally = (entries: MdxTarget[], key: string): string => {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const s = (attr(e, key) ?? "").toLowerCase();
    if (s !== "") {
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
  }
  const parts = [...counts.entries()].map(([s, n]) => `${n} ${s}`);
  return parts.length === 0 ? "" : ` — ${parts.join(" · ")}`;
};

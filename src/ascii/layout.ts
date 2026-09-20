/** ASCII renderers for layout components — markdown is single-column, so
 *  grids/columns flatten into sequential sections with explicit labels. */

import type { RootContent } from "mdast";

import { nonEmpty } from "../guards.js";
import { attr, named, para, strong, thematic, txt } from "./ast.js";
import type { AsciiRegistry } from "./ast.js";

// oxlint-disable sort-keys -- keys grouped by component family, not alphabet
export const layoutRenderers: AsciiRegistry = {
  // Side-by-side columns can't exist in markdown — each column becomes a
  // section separated by a horizontal rule.
  Columns: {
    flow: (n, ctx) => {
      const out: RootContent[] = [];
      let first = true;
      for (const c of n.children ?? []) {
        const isCol = named(c, "Column");
        if (!isCol) {
          out.push(...ctx.children({ ...n, children: [c] }));
          continue;
        }
        if (!first) {
          out.push(thematic());
        }
        out.push(...ctx.children({ ...n, children: [c] }));
        first = false;
      }
      return out;
    },
  },
  Column: { flow: (n, ctx) => ctx.children(n) },
  Grid: { flow: (n, ctx) => ctx.children(n) },
  Cell: { flow: (n, ctx) => ctx.children(n) },
  // A flex row collapses to a paragraph sequence; the gap prop is visual.
  Row: { flow: (n, ctx) => ctx.children(n) },
  Stack: { flow: (n, ctx) => ctx.children(n) },
  Before: {
    flow: (n, ctx) => [
      para([
        strong([
          txt(
            nonEmpty(attr(n, "title"))
              ? `Before — ${attr(n, "title")}`
              : "Before"
          ),
        ]),
      ]),
      ...ctx.children(n),
    ],
  },
  After: {
    flow: (n, ctx) => [
      para([
        strong([
          txt(
            nonEmpty(attr(n, "title")) ? `After — ${attr(n, "title")}` : "After"
          ),
        ]),
      ]),
      ...ctx.children(n),
    ],
  },
};

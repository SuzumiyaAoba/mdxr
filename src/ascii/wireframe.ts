import { safeHref } from "../guards.js";
import { attrTrue } from "../ui/attrs.js";
import {
  attr,
  icode,
  item,
  link,
  list,
  num,
  para,
  pre,
  quote,
  strong,
  txt,
} from "./ast.js";
import type { AsciiEntry, AsciiRegistry, MdxTarget } from "./ast.js";
import { wireframeCatalogRenderers } from "./wireframe-catalog.js";

const unwrap: AsciiEntry = {
  flow: (n, ctx) => ctx.children(n),
  text: (n, ctx) => ctx.inline(n),
};
const title: AsciiEntry = {
  flow: (n, ctx) => [para([strong(ctx.inline(n))])],
  text: (n, ctx) => [strong(ctx.inline(n))],
};
const countOf = (n: MdxTarget, prop: string): number =>
  Math.max(1, Math.min(50, Math.floor(num(n, prop) ?? 3)));
const placeholder = (fallback: string): AsciiEntry => ({
  text: (n) => [icode(`[${attr(n, "label") ?? fallback}]`)],
});
const field: AsciiEntry = {
  text: (n) => [
    txt(`${attr(n, "label") ?? "Input"}: `),
    icode(
      `[${attr(n, "defaultValue") ?? attr(n, "placeholder") ?? "________"}]`
    ),
  ],
};

const coreRenderers: AsciiRegistry = {
  Wireframe: {
    flow: (n, ctx) => [
      para([strong([txt(attr(n, "title") ?? "Wireframe")])]),
      quote(ctx.children(n)),
    ],
  },
  WireframeAvatar: {
    text: (n, ctx) => [
      icode(`[${ctx.text(n) || (attr(n, "label") ?? "avatar")}]`),
    ],
  },
  WireframeBadge: {
    text: (n, ctx) => [
      icode(`[${ctx.text(n) || (attr(n, "label") ?? "badge")}]`),
    ],
  },
  WireframeButton: {
    text: (n, ctx) => {
      const label = ctx.text(n) || (attr(n, "label") ?? "button");
      const href = safeHref(attr(n, "href"));
      return href !== undefined && !attrTrue(attr(n, "disabled"))
        ? [link(href, [txt(label)])]
        : [icode(`[${label}]`)];
    },
  },
  WireframeCard: {
    flow: (n, ctx) => [quote(ctx.children(n))],
    text: (n, ctx) => ctx.inline(n),
  },
  WireframeCardAction: unwrap,
  WireframeCardContent: unwrap,
  WireframeCardDescription: unwrap,
  WireframeCardFooter: unwrap,
  WireframeCardHeader: unwrap,
  WireframeCardTitle: title,
  WireframeHeading: {
    text: (n, ctx) => [
      strong([txt(ctx.text(n) || (attr(n, "label") ?? "Heading placeholder"))]),
    ],
  },
  WireframeInput: field,
  WireframeList: {
    flow: (n) => [
      list(
        Array.from({ length: countOf(n, "items") }, () =>
          item([para([icode("[────────]")])])
        ),
        attr(n, "variant") === "number"
      ),
    ],
  },
  WireframeMedia: {
    text: (n) => {
      const src = safeHref(attr(n, "src"));
      const label =
        attr(n, "label") ??
        attr(n, "alt") ??
        `${attr(n, "type") ?? "image"} placeholder`;
      if (src === undefined) {
        return [icode(`[${label}]`)];
      }
      return attr(n, "type") === "audio" || attr(n, "type") === "video"
        ? [link(src, [txt(label)])]
        : [{ alt: label, type: "image", url: src }];
    },
  },
  WireframeParagraph: {
    flow: (n) => [
      pre(
        Array.from({ length: countOf(n, "lines") }, (_, index) =>
          index === countOf(n, "lines") - 1 ? "────────" : "────────────────"
        ).join("\n")
      ),
    ],
  },
  WireframeSection: {
    flow: (n, ctx) => {
      const children = ctx.children(n);
      return children.length > 0
        ? children
        : [para([icode(`[${attr(n, "variant") ?? "custom"} section]`)])];
    },
  },
  WireframeStack: unwrap,
  WireframeText: placeholder("────────"),
  WireframeTextarea: field,
};

export const wireframeRenderers: AsciiRegistry = {
  ...wireframeCatalogRenderers,
  ...coreRenderers,
  WireframeChart: wireframeCatalogRenderers.WireframeChartWireframe,
  WireframeListGroup: coreRenderers.WireframeList,
  WireframeTextCaption: coreRenderers.WireframeText,
  WireframeTextHeading: coreRenderers.WireframeText,
  WireframeTextLabel: coreRenderers.WireframeText,
  WireframeTextParagraph: coreRenderers.WireframeText,
};

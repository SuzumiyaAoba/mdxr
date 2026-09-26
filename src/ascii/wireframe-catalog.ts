import type { Node } from "unist";

import { own } from "../guards.js";
import { isParent } from "../remark/ast.js";
import registry from "../wireframe/registry.json";
import { icode, para } from "./ast.js";
import type { AsciiEntry, AsciiRegistry } from "./ast.js";
import { shadcnRenderers } from "./shadcn.js";

// Compound renderers inspect their children's tag names (TableRow, TabsContent,
// etc.). Translate the complete subtree before reusing those renderers.
const canonicalNames = new Map(
  registry.families.flatMap(({ components }) =>
    components
      .filter((name) => Object.hasOwn(shadcnRenderers, name))
      .map((name) => [`Wireframe${name}`, name])
  )
);
const canonical = <T extends Node>(node: T): T => {
  const out = { ...node };
  if (isParent(node)) {
    Object.assign(out, { children: node.children.map(canonical) });
  }
  if ("name" in node && typeof node.name === "string") {
    const name = canonicalNames.get(node.name);
    if (name !== undefined) {
      Object.assign(out, { name });
    }
  }
  return out;
};

const adapt = (entry: AsciiEntry): AsciiEntry => ({
  ...(entry.flow === undefined
    ? {}
    : { flow: (node, ctx) => entry.flow?.(canonical(node), ctx) ?? [] }),
  ...(entry.text === undefined
    ? {}
    : { text: (node, ctx) => entry.text?.(canonical(node), ctx) ?? [] }),
});

const fallback = (name: string, block: boolean): AsciiEntry => ({
  flow: (node, ctx) => {
    const children = ctx.children(node);
    return children.length > 0
      ? children
      : [
          para([
            icode(`[${block ? "Wireframe screen" : "Wireframe"}: ${name}]`),
          ]),
        ];
  },
  text: (node, ctx) => {
    const children = ctx.inline(node);
    return children.length > 0 ? children : [icode(`[Wireframe: ${name}]`)];
  },
});

export const wireframeCatalogRenderers: AsciiRegistry = Object.fromEntries(
  registry.families.flatMap(({ components, kind }) =>
    components.map((name) => {
      const existing = own(shadcnRenderers, name);
      return [
        `Wireframe${name}`,
        existing === undefined
          ? fallback(name, kind === "block")
          : adapt(existing),
      ];
    })
  )
);

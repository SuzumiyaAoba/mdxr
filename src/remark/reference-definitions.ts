import type { Node } from "unist";
import { visit } from "unist-util-visit";

export const referenceDefinitions = (tree: Node): Map<string, Node> => {
  const definitions = new Map<string, Node>();
  visit(tree, ["definition", "footnoteDefinition"], (node) => {
    if ("identifier" in node && typeof node.identifier === "string") {
      const key = `${node.type}:${node.identifier}`;
      if (!definitions.has(key)) {
        definitions.set(key, node);
      }
    }
  });
  return definitions;
};

/** Follow references recursively, including links within footnote definitions. */
export const referencedContent = (
  section: Node,
  definitions: Map<string, Node>
): Node[] => {
  const found = new Set<Node>();
  const collect = (tree: Node): void => {
    visit(
      tree,
      ["linkReference", "imageReference", "footnoteReference"],
      (node) => {
        if (!("identifier" in node) || typeof node.identifier !== "string") {
          return;
        }
        const kind =
          node.type === "footnoteReference"
            ? "footnoteDefinition"
            : "definition";
        const definition = definitions.get(`${kind}:${node.identifier}`);
        if (definition !== undefined && !found.has(definition)) {
          found.add(definition);
          collect(definition);
        }
      }
    );
  };
  collect(section);
  return [...found];
};

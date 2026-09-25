import type { Node } from "unist";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

import type { AnnotationSource } from "../annotations.js";
import { isRecord } from "../guards.js";
import { jsxAttr, textContent } from "./ast.js";
import type { MdxTarget } from "./ast.js";

declare module "vfile" {
  interface DataMap {
    annotationSources?: AnnotationSource[];
  }
}

/** A sidecar source index: no wrappers or props that change component children. */
export const remarkAnnotationSources =
  () =>
  (tree: Node, file: VFile): void => {
    const sources: AnnotationSource[] = [];
    let heading = "";
    visit(tree, (node: MdxTarget) => {
      if (node.type === "heading") {
        heading = textContent(node).trim();
      }
      if (
        node.position === undefined ||
        node.name === "Include" ||
        ![
          "paragraph",
          "heading",
          "code",
          "image",
          "mdxJsxFlowElement",
          "mdxJsxTextElement",
        ].includes(node.type)
      ) {
        return;
      }
      const origin = isRecord(node.data) ? node.data.mdxrSourceFile : undefined;
      const label =
        jsxAttr(node, "caption") ??
        jsxAttr(node, "title") ??
        jsxAttr(node, "aria-label") ??
        jsxAttr(node, "alt") ??
        "";
      const image =
        "url" in node && typeof node.url === "string"
          ? node.url
          : (jsxAttr(node, "src") ?? "");
      const text =
        typeof node.value === "string" ? node.value : textContent(node);
      sources.push({
        end: node.position.end.line,
        file: typeof origin === "string" ? origin : file.path,
        heading,
        image,
        label,
        start: node.position.start.line,
        text,
      });
    });
    file.data.annotationSources = sources;
  };

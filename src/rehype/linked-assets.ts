import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";

import type { Root } from "hast";
import type { Node } from "unist";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

import { isRecord, own } from "../guards.js";

export interface LinkedAssetsOptions {
  enabled?: boolean;
}

const IMAGE_MIME_TYPES: Readonly<Record<string, string>> = {
  ".apng": "image/apng",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".jxl": "image/jxl",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".webp": "image/webp",
};

const JSX_IMAGE_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  Figure: ["src"],
  img: ["src"],
  video: ["poster"],
};

const REMOTE_OR_ROOTED = /^(?:[a-z][a-z\d+.-]*:|\/|#)/iu;

const localAssetPath = (source: string): string => {
  const query = source.indexOf("?");
  const hash = source.indexOf("#");
  let suffixStart = source.length;
  for (const index of [query, hash]) {
    if (index >= 0) {
      suffixStart = Math.min(suffixStart, index);
    }
  }
  const sourcePath = source.slice(0, suffixStart);
  try {
    return decodeURIComponent(sourcePath);
  } catch {
    return sourcePath;
  }
};

const withFragment = (source: string): string => {
  const hash = source.indexOf("#");
  return hash === -1 ? "" : source.slice(hash);
};

const dataUrl = (
  source: string,
  node: Node,
  file: VFile,
  root: string
): string | undefined => {
  if (source === "" || REMOTE_OR_ROOTED.test(source)) {
    return undefined;
  }

  const assetPath = localAssetPath(source);
  const mime = IMAGE_MIME_TYPES[path.extname(assetPath).toLowerCase()];
  if (mime === undefined) {
    return undefined;
  }

  let canonicalPath: string;
  let contents: Buffer;
  try {
    canonicalPath = realpathSync(path.resolve(root, assetPath));
    contents = readFileSync(canonicalPath);
  } catch (error) {
    const code = isRecord(error) ? error.code : undefined;
    if (code === "ENOENT" || code === "ENOTDIR") {
      file.fail(
        `Linked image not found: ${source}`,
        node,
        "mdxr:linked-assets"
      );
    }
    throw error;
  }

  file.data.includeDependencies ??= [];
  if (!file.data.includeDependencies.includes(canonicalPath)) {
    file.data.includeDependencies.push(canonicalPath);
  }

  return `data:${mime};base64,${contents.toString("base64")}${withFragment(source)}`;
};

const inlineHastMedia = (node: Node, file: VFile, root: string): void => {
  if (!isRecord(node)) {
    return;
  }

  const { properties, tagName, type } = node;
  if (type !== "element" || !isRecord(properties)) {
    return;
  }
  if (tagName !== "img" && tagName !== "video") {
    return;
  }

  const attribute = tagName === "img" ? "src" : "poster";
  const source = properties[attribute];
  if (typeof source !== "string") {
    return;
  }

  const inline = dataUrl(source, node, file, root);
  if (inline !== undefined) {
    properties[attribute] = inline;
  }
};

const inlineMdxMedia = (node: Node, file: VFile, root: string): void => {
  if (
    !isRecord(node) ||
    (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") ||
    typeof node.name !== "string" ||
    !Array.isArray(node.attributes)
  ) {
    return;
  }

  const imageAttributes = own(JSX_IMAGE_ATTRIBUTES, node.name);
  if (imageAttributes === undefined) {
    return;
  }

  for (const attribute of node.attributes) {
    if (
      !isRecord(attribute) ||
      typeof attribute.name !== "string" ||
      !imageAttributes.includes(attribute.name) ||
      typeof attribute.value !== "string"
    ) {
      continue;
    }

    const inline = dataUrl(attribute.value, node, file, root);
    if (inline !== undefined) {
      attribute.value = inline;
    }
  }
};

/** Inline local image assets used by a linked document's standalone HTML. */
export const rehypeLinkedAssets =
  (opts: LinkedAssetsOptions = {}) =>
  (tree: Root, file: VFile): void => {
    if (opts.enabled !== true) {
      return;
    }

    const root = file.dirname ?? process.cwd();
    visit(tree, (node) => {
      inlineHastMedia(node, file, root);
      inlineMdxMedia(node, file, root);
    });
  };

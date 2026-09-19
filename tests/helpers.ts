import { mdxToHtml } from "../src/mdx.js";
import { builtinComponents } from "../src/ui/index.js";

/**
 * Static markup for substring assertions — `hydrate: false` renders with
 * renderToStaticMarkup, avoiding the `<!-- -->` text-boundary comments
 * renderToString emits for hydrated docs.
 */
export const renderDoc = async (src: string, docPath = "document.mdx") =>
  await mdxToHtml(src, builtinComponents, docPath, { hydrate: false });

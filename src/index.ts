// Public entry: `@suzumiyaaoba/mdxr`
// API surface for mdxr.config.ts and custom component modules.
export { defineConfig, type MdxrConfig } from "./config.js";
export {
  defineComponent,
  textOf,
  type ComponentMeta,
  type MdxrComponent,
} from "./define.js";
export { DocContext } from "./doc-context.js";
// Also part of the root surface: config modules may want the catalog
// without importing `@suzumiyaaoba/mdxr/components`. The hydration bundle
// mirrors each
// specifier's real surface, so the two entries stay distinct.
export { builtinComponents } from "./ui/index.js";
export * as v from "valibot";

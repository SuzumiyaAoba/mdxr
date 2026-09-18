// Public entry: `mdxr`
// API surface for mdxr.config.ts and custom component modules.
export { defineConfig, type MdxrConfig } from "./config.js";
export {
  defineComponent,
  textOf,
  type ComponentMeta,
  type MdxrComponent,
} from "./define.js";
export { DocContext } from "./doc-context.js";
// The hydration bundle maps `mdxr` and `mdxr/components` identically —
// anything reachable through one specifier must resolve through the other,
// or SSR would see `undefined` where the client sees the real export.
export { builtinComponents } from "./ui/index.js";
export * as v from "valibot";

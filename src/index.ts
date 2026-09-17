// Public entry: `mdxr`
// API surface for mdxr.config.ts and custom component modules.
export { defineConfig, type MdxrConfig } from "./config.js";
export {
  defineComponent,
  textOf,
  type ComponentMeta,
  type MdxrComponent,
} from "./define.js";
export * as v from "valibot";

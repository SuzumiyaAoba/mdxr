// Public entry: `@suzumiyaaoba/rv`
// API surface for rv.config.ts and custom component modules.
export { defineConfig, type RvConfig } from "./config.js";
export {
  defineComponent,
  textOf,
  type ComponentMeta,
  type RvComponent,
} from "./define.js";
export * as v from "valibot";

// Public entry: `@suzumiyaaoba/rv/components`
// Re-export the built-in catalog so custom components can compose them.
export {
  builtinComponents,
  Callout,
  FileRef,
  Phase,
  Plan,
  Pre,
  StatusBadge,
  Step,
  Steps,
  Summary,
} from "./ui/index.js";
export {
  defineComponent,
  textOf,
  type ComponentMeta,
  type RvComponent,
} from "./define.js";

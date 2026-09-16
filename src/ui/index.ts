import type { ComponentMap } from "../define.js";
import { Callout } from "./callout.js";
import { FileRef } from "./file-ref.js";
import { Phase } from "./phase.js";
import { Plan } from "./plan.js";
import { Pre } from "./pre.js";
import { shadcnComponents } from "./shadcn.js";
import { StatusBadge } from "./status-badge.js";
import { Step, Steps } from "./steps.js";
import { Summary } from "./summary.js";

export { Callout } from "./callout.js";
export { FileRef } from "./file-ref.js";
export { Phase } from "./phase.js";
export { Plan } from "./plan.js";
export { Pre } from "./pre.js";
export { StatusBadge } from "./status-badge.js";
export { Step, Steps } from "./steps.js";
export { Summary } from "./summary.js";

/**
 * The built-in component catalog available inside rv documents.
 * `pre` overrides fenced code blocks; the rest are usable as MDX JSX elements.
 * shadcn/ui (Base UI) primitives are included — interactive parts render
 * their initial state since documents have no client-side hydration.
 */
export const builtinComponents: ComponentMap = {
  Callout,
  FileRef,
  Phase,
  Plan,
  StatusBadge,
  Step,
  Steps,
  Summary,
  pre: Pre,
  ...shadcnComponents,
};

import type { ComponentMap } from "../define.js";
import { Approval, Approvals } from "./approvals.js";
import { Callout } from "./callout.js";
import { Column, Columns } from "./columns.js";
import { Decision } from "./decision.js";
import { Due } from "./due.js";
import { Effort } from "./effort.js";
import { FileRef } from "./file-ref.js";
import { Icon } from "./icon.js";
import { Meta, MetaItem } from "./meta.js";
import { Option } from "./option.js";
import { Owner } from "./owner.js";
import { Phase } from "./phase.js";
import { Plan } from "./plan.js";
import { Pre } from "./pre.js";
import { Priority } from "./priority.js";
import { Risk } from "./risk.js";
import { shadcnComponents } from "./shadcn.js";
import { Stat, Stats } from "./stats.js";
import { StatusBadge } from "./status-badge.js";
import { Step, Steps } from "./steps.js";
import { Summary } from "./summary.js";
import { Event, Timeline } from "./timeline.js";
import { Tree } from "./tree.js";

export { Approval, Approvals } from "./approvals.js";
export { Callout, CALLOUT_KINDS } from "./callout.js";
export { Column, Columns } from "./columns.js";
export { Decision, DECISION_STATUSES } from "./decision.js";
export { Due } from "./due.js";
export { Effort, EFFORT_SIZES } from "./effort.js";
export { FileRef } from "./file-ref.js";
export { hasIcon, Icon, normalizeIconName } from "./icon.js";
export { Meta, MetaItem } from "./meta.js";
export { Option, OPTION_STATUSES } from "./option.js";
export { Owner } from "./owner.js";
export { Phase } from "./phase.js";
export { Plan, PlanHeader } from "./plan.js";
export { Pre } from "./pre.js";
export { Priority, PRIORITY_LEVELS } from "./priority.js";
export { Risk, RISK_LEVELS } from "./risk.js";
export { Stat, Stats } from "./stats.js";
export { StatusBadge, STATUSES } from "./status-badge.js";
export { Step, Steps } from "./steps.js";
export { Summary } from "./summary.js";
export { Event, Timeline } from "./timeline.js";
export { Tree } from "./tree.js";

/**
 * The built-in component catalog available inside rv documents.
 * `pre` overrides fenced code blocks; the rest are usable as MDX JSX elements.
 * shadcn/ui (Base UI) primitives are included — interactive parts render
 * their initial state since documents have no client-side hydration.
 */
export const builtinComponents: ComponentMap = {
  Approval,
  Approvals,
  Callout,
  Column,
  Columns,
  Decision,
  Due,
  Effort,
  Event,
  FileRef,
  Icon,
  Meta,
  MetaItem,
  Option,
  Owner,
  Phase,
  Plan,
  Priority,
  Risk,
  Stat,
  Stats,
  StatusBadge,
  Step,
  Steps,
  Summary,
  Timeline,
  Tree,
  pre: Pre,
  ...shadcnComponents,
};

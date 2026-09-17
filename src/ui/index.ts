import type { ComponentMap } from "../define.js";
import { Approval, Approvals } from "./approvals.js";
import { Ask, Choice, Question } from "./ask.js";
import { Callout } from "./callout.js";
import { Change, Changes } from "./changes.js";
import { Cmd } from "./cmd.js";
import { Column, Columns } from "./columns.js";
import { After, Before } from "./compare.js";
import { Decision } from "./decision.js";
import { Dep, Deps } from "./deps.js";
import { Details } from "./details.js";
import { Due } from "./due.js";
import { Effort } from "./effort.js";
import { Figure } from "./figure.js";
import { FileRef } from "./file-ref.js";
import { File, Files } from "./files.js";
import { Finding, Findings } from "./findings.js";
import { Flow, FlowStep } from "./flow.js";
import { Glossary, Term } from "./glossary.js";
import { Cell, Grid } from "./grid.js";
import { Icon } from "./icon.js";
import { Meta, MetaItem } from "./meta.js";
import { Option } from "./option.js";
import { Owner } from "./owner.js";
import { Phase } from "./phase.js";
import { Plan } from "./plan.js";
import { Pre } from "./pre.js";
import { Priority } from "./priority.js";
import { Prop, Props } from "./props.js";
import { Commit, Issue, PR, Ref } from "./ref.js";
import { Req, Reqs } from "./req.js";
import { Risk } from "./risk.js";
import { shadcnComponents } from "./shadcn.js";
import { Stat, Stats } from "./stats.js";
import { StatusBadge } from "./status-badge.js";
import { Step, Steps } from "./steps.js";
import { Summary } from "./summary.js";
import { SymbolRef } from "./symbol-ref.js";
import { Event, Timeline } from "./timeline.js";
import { Toc } from "./toc.js";
import { Tree } from "./tree.js";

export { Approval, Approvals } from "./approvals.js";
export { Ask, Choice, Question, QUESTION_TYPES } from "./ask.js";
export { Callout, CALLOUT_KINDS } from "./callout.js";
export { Change, CHANGE_KINDS, Changes } from "./changes.js";
export { Cmd } from "./cmd.js";
export { Column, Columns } from "./columns.js";
export { After, Before } from "./compare.js";
export { Decision, DECISION_STATUSES } from "./decision.js";
export { Dep, DEP_KINDS, Deps } from "./deps.js";
export { Details } from "./details.js";
export { Due } from "./due.js";
export { Effort, EFFORT_SIZES } from "./effort.js";
export { Figure } from "./figure.js";
export { FileRef } from "./file-ref.js";
export { File, FILE_KINDS, Files } from "./files.js";
export { CONFIDENCES, Finding, Findings } from "./findings.js";
export { Flow, FlowStep } from "./flow.js";
export { Glossary, Term } from "./glossary.js";
export { Cell, Grid } from "./grid.js";
export { hasIcon, Icon, normalizeIconName } from "./icon.js";
export { Meta, MetaItem } from "./meta.js";
export { Option, OPTION_STATUSES } from "./option.js";
export { Owner } from "./owner.js";
export { Phase } from "./phase.js";
export { Plan, PlanHeader } from "./plan.js";
export { Pre } from "./pre.js";
export { Priority, PRIORITY_LEVELS } from "./priority.js";
export { Prop, Props } from "./props.js";
export { Commit, Issue, PR, Ref } from "./ref.js";
export { Req, Reqs } from "./req.js";
export { Risk, RISK_LEVELS } from "./risk.js";
export { Stat, Stats } from "./stats.js";
export { StatusBadge, STATUSES } from "./status-badge.js";
export { Step, Steps } from "./steps.js";
export { Summary } from "./summary.js";
export { SYMBOL_KINDS, SymbolRef } from "./symbol-ref.js";
export { Event, Timeline } from "./timeline.js";
export { Toc } from "./toc.js";
export { Tree } from "./tree.js";

/**
 * The built-in component catalog available inside rv documents.
 * `pre` overrides fenced code blocks; the rest are usable as MDX JSX elements.
 * shadcn/ui (Base UI) primitives are included — interactive parts render
 * their initial state since documents have no client-side hydration.
 * `Toc` and `CodeFile` are remark-level features (injected/expanded before
 * render); `Toc` still needs this entry so MDX accepts the element.
 */
export const builtinComponents: ComponentMap = {
  After,
  Approval,
  Approvals,
  Ask,
  Before,
  Callout,
  Cell,
  Change,
  Changes,
  Choice,
  Cmd,
  Column,
  Columns,
  Commit,
  Decision,
  Dep,
  Deps,
  Details,
  Due,
  Effort,
  Event,
  Figure,
  File,
  FileRef,
  Files,
  Finding,
  Findings,
  Flow,
  FlowStep,
  Glossary,
  Grid,
  Icon,
  Issue,
  Meta,
  MetaItem,
  Option,
  Owner,
  PR,
  Phase,
  Plan,
  Priority,
  Prop,
  Props,
  Question,
  Ref,
  Req,
  Reqs,
  Risk,
  Stat,
  Stats,
  StatusBadge,
  Step,
  Steps,
  Summary,
  SymbolRef,
  Term,
  Timeline,
  Toc,
  Tree,
  pre: Pre,
  ...shadcnComponents,
};

import type { ComponentMap } from "../define.js";
import { Approval, Approvals } from "./approvals.js";
import { Ask, Choice, Question } from "./ask.js";
import { Bar, BarChart } from "./bar-chart.js";
import { Board, BoardCard, Lane } from "./board.js";
import { Bridge, Delta } from "./bridge.js";
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
import { Endpoint, Endpoints } from "./endpoints.js";
import { Figure } from "./figure.js";
import { FileRef } from "./file-ref.js";
import { File, Files } from "./files.js";
import { Finding, Findings } from "./findings.js";
import { Flow, FlowStep } from "./flow.js";
import { Funnel, Stage } from "./funnel.js";
import { Gantt, Milestone, Task } from "./gantt.js";
import { Glossary, Term } from "./glossary.js";
import { Edge, Graph, Node } from "./graph.js";
import { Cell, Grid } from "./grid.js";
import { Hypotheses, Hypothesis } from "./hypothesis.js";
import { Icon } from "./icon.js";
import { Del, Ins } from "./ins-del.js";
import { Json } from "./json.js";
import { LineChart } from "./line-chart.js";
import { Matrix } from "./matrix.js";
import { Meta, MetaItem } from "./meta.js";
import { Option } from "./option.js";
import { Owner } from "./owner.js";
import { Phase } from "./phase.js";
import { PieChart, Slice } from "./pie-chart.js";
import { Plan } from "./plan.js";
import { Pre } from "./pre.js";
import { Priority } from "./priority.js";
import { Prop, Props } from "./props.js";
import { Pin, Quadrant } from "./quadrant.js";
import { Radar } from "./radar.js";
import { Commit, Issue, PR, Ref } from "./ref.js";
import { Req, Reqs } from "./req.js";
import { Risk } from "./risk.js";
import { Link, Sankey } from "./sankey.js";
import { Point, Scatter } from "./scatter.js";
import { Search, Searches } from "./search.js";
import { Series } from "./series.js";
import { shadcnComponents } from "./shadcn.js";
import { Row, Stack } from "./stack.js";
import { Stat, Stats } from "./stats.js";
import { StatusBadge } from "./status-badge.js";
import { Step, Steps } from "./steps.js";
import { Summary } from "./summary.js";
import { SymbolRef } from "./symbol-ref.js";
import { Terminal } from "./terminal.js";
import { Test, Tests } from "./tests.js";
import { Event, Timeline } from "./timeline.js";
import { Toc } from "./toc.js";
import { Trace, TraceFrame } from "./trace.js";
import { Tree } from "./tree.js";
import { Tile, Treemap } from "./treemap.js";
import { Overlap, Set, Venn } from "./venn.js";
import { Span, Waterfall } from "./waterfall.js";

export { Approval, Approvals } from "./approvals.js";
export { Ask, Choice, Question, QUESTION_TYPES } from "./ask.js";
export { Bar, BarChart } from "./bar-chart.js";
export { Bridge, Delta } from "./bridge.js";
export { Callout, CALLOUT_KINDS } from "./callout.js";
export { Change, CHANGE_KINDS, Changes } from "./changes.js";
export { Cmd } from "./cmd.js";
export { Column, Columns } from "./columns.js";
export { Board, BoardCard, Lane } from "./board.js";
export { After, Before } from "./compare.js";
export { Decision, DECISION_STATUSES } from "./decision.js";
export { Dep, DEP_KINDS, Deps } from "./deps.js";
export { Details } from "./details.js";
export { DiffView, parseDiff } from "./diff.js";
export type { FileDiff } from "./diff.js";
export { Due } from "./due.js";
export { Effort, EFFORT_SIZES } from "./effort.js";
export { Endpoint, Endpoints, HTTP_METHODS } from "./endpoints.js";
export { Figure } from "./figure.js";
export { FileRef } from "./file-ref.js";
export { File, FILE_KINDS, Files } from "./files.js";
export { CONFIDENCES, Finding, Findings } from "./findings.js";
export { Flow, FlowStep } from "./flow.js";
export { Funnel, Stage } from "./funnel.js";
export { Gantt, Milestone, Task } from "./gantt.js";
export { Glossary, Term } from "./glossary.js";
export { Edge, Graph, Node } from "./graph.js";
export { Cell, Grid } from "./grid.js";
export { Hypotheses, Hypothesis, HYPOTHESIS_STATUSES } from "./hypothesis.js";
export { hasIcon, Icon, normalizeIconName } from "./icon.js";
export { Del, Ins } from "./ins-del.js";
export { Json } from "./json.js";
export { LineChart } from "./line-chart.js";
export { Matrix } from "./matrix.js";
export { Meta, MetaItem } from "./meta.js";
export { Option, OPTION_STATUSES } from "./option.js";
export { Owner } from "./owner.js";
export { Phase } from "./phase.js";
export { PieChart, Slice } from "./pie-chart.js";
export { Pin, Quadrant } from "./quadrant.js";
export { Plan, PlanHeader } from "./plan.js";
export { Pre } from "./pre.js";
export { Priority, PRIORITY_LEVELS } from "./priority.js";
export { Prop, Props } from "./props.js";
export { Radar } from "./radar.js";
export { Commit, Issue, PR, Ref } from "./ref.js";
export { Req, Reqs } from "./req.js";
export { Risk, RISK_LEVELS } from "./risk.js";
export { Link, Sankey } from "./sankey.js";
export { Point, Scatter } from "./scatter.js";
export { Search, Searches } from "./search.js";
export { Series } from "./series.js";
export { Row, Stack } from "./stack.js";
export { Stat, Stats } from "./stats.js";
export { StatusBadge, STATUSES } from "./status-badge.js";
export { Step, Steps } from "./steps.js";
export { Summary } from "./summary.js";
export { SYMBOL_KINDS, SymbolRef } from "./symbol-ref.js";
export { TERMINAL_LANGS, Terminal } from "./terminal.js";
export { Test, TEST_STATUSES, Tests } from "./tests.js";
export { Event, Timeline } from "./timeline.js";
export { Toc } from "./toc.js";
export { FRAME_KINDS, Trace, TraceFrame } from "./trace.js";
export { Tree } from "./tree.js";
export { Tile, Treemap } from "./treemap.js";
export { Overlap, Set, Venn } from "./venn.js";
export { Span, Waterfall } from "./waterfall.js";

/**
 * The built-in component catalog available inside mdxr documents.
 * `pre` overrides fenced code blocks; the rest are usable as MDX JSX elements.
 * shadcn/ui (Base UI) primitives are included — rendered documents carry a
 * hydration bundle, so interactive parts work in the browser.
 * `Toc` and `CodeFile` are remark-level features (injected/expanded before
 * render); `Toc` still needs this entry so MDX accepts the element.
 */
export const builtinComponents: ComponentMap = {
  After,
  Approval,
  Approvals,
  Ask,
  Bar,
  BarChart,
  Before,
  Board,
  BoardCard,
  Bridge,
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
  Del,
  Delta,
  Dep,
  Deps,
  Details,
  Due,
  Edge,
  Effort,
  Endpoint,
  Endpoints,
  Event,
  Figure,
  File,
  FileRef,
  Files,
  Finding,
  Findings,
  Flow,
  FlowStep,
  Funnel,
  Gantt,
  Glossary,
  Graph,
  Grid,
  Hypotheses,
  Hypothesis,
  Icon,
  Ins,
  Issue,
  Json,
  Lane,
  LineChart,
  Link,
  Matrix,
  Meta,
  MetaItem,
  Milestone,
  Node,
  Option,
  Overlap,
  Owner,
  PR,
  Phase,
  PieChart,
  Pin,
  Plan,
  Point,
  Priority,
  Prop,
  Props,
  Quadrant,
  Question,
  Radar,
  Ref,
  Req,
  Reqs,
  Risk,
  Row,
  Sankey,
  Scatter,
  Search,
  Searches,
  Series,
  Set,
  Slice,
  Span,
  Stack,
  Stage,
  Stat,
  Stats,
  StatusBadge,
  Step,
  Steps,
  Summary,
  SymbolRef,
  Task,
  Term,
  Terminal,
  Test,
  Tests,
  Tile,
  Timeline,
  Toc,
  Trace,
  TraceFrame,
  Tree,
  Treemap,
  Venn,
  Waterfall,
  pre: Pre,
  ...shadcnComponents,
};

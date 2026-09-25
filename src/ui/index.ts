import type { ComponentMap } from "../define.js";
import { Approval, Approvals } from "./approvals.js";
import { Ask, Choice, Question } from "./ask.js";
import { Audit, Vuln } from "./audit.js";
import { Bar, BarChart } from "./bar-chart.js";
import { Bench, Benchmarks } from "./benchmarks.js";
import { Board, BoardCard, Lane } from "./board.js";
import { Bridge, Delta } from "./bridge.js";
import { Bump, Bumps } from "./bumps.js";
import { Callout } from "./callout.js";
import { Change, Changes } from "./changes.js";
import { Check, Checks } from "./checks.js";
import { Cmd } from "./cmd.js";
import { Column, Columns } from "./columns.js";
import { Comments } from "./comments.js";
import { After, Before } from "./compare.js";
import { DataTable, FilterPanel, DownloadData } from "./data-table.js";
import { Decision } from "./decision.js";
import { Dep, Deps } from "./deps.js";
import { Details } from "./details.js";
import { JourneyMap } from "./diagrams-reports.js";
import { DiffStat } from "./diffstat.js";
import {
  Checklist,
  Ranking,
  Calculator,
  Wizard,
  AnswerSheet,
  PromptTemplate,
  DocumentSearch,
} from "./document-inputs.js";
import {
  ImageGallery,
  AnnotatedImage,
  ImageCompare,
  VisualDiff,
  Video,
  AudioTranscript,
  PdfPreview,
  PrintLayout,
  PageBreak,
} from "./document-media.js";
import {
  Sources,
  Source,
  Cite,
  CrossRef,
  TermRef,
  Sidenote,
  Include,
  TableOfFigures,
  NumberedEquation,
  Theorem,
  Proof,
} from "./document-references.js";
import {
  CodeGroup,
  SyncedTabs,
  TabItem,
  PackageInstall,
  CodeWalkthrough,
  Request,
  Response,
  ApiExample,
  Conversation,
} from "./document-tabs.js";
import { Due } from "./due.js";
import { Effort } from "./effort.js";
import { Endpoint, Endpoints } from "./endpoints.js";
import { EnvVar, EnvVars } from "./envvars.js";
import {
  EvalReport,
  ModelComparison,
  ToolCall,
  TokenUsage,
  DatasetProfile,
  DataValidation,
  Experiment,
  EvalCase,
} from "./evaluation-reports.js";
import {
  Evidence,
  Provenance,
  Assumptions,
  Limitations,
  DocumentHistory,
} from "./evidence-reports.js";
import { Figure } from "./figure.js";
import { FileRef } from "./file-ref.js";
import { File, Files } from "./files.js";
import { Finding, Findings } from "./findings.js";
import { Flow, FlowStep } from "./flow.js";
import { Funnel, Stage } from "./funnel.js";
import { Gantt, Milestone, Task } from "./gantt.js";
import { Gauge, Gauges } from "./gauges.js";
import { Glossary, Term } from "./glossary.js";
import { Edge, Graph, Node } from "./graph.js";
import { Cell, Grid } from "./grid.js";
import { Hypotheses, Hypothesis } from "./hypothesis.js";
import { Icon } from "./icon.js";
import { Incident } from "./incident.js";
import { Del, Ins } from "./ins-del.js";
import { Reproduction, Logs, SymbolOutline } from "./investigation-reports.js";
import { Json } from "./json.js";
import { LineChart } from "./line-chart.js";
import { Matrix } from "./matrix.js";
import { Meta, MetaItem } from "./meta.js";
import { ObjectSchema } from "./object-schema.js";
import {
  Runbook,
  Rollout,
  SLO,
  AlertRules,
  FeatureFlags,
  RecoveryPlan,
  PermissionMatrix,
  ThreatModel,
  Remediation,
  MaintenanceWindow,
  ErrorBudget,
} from "./operations-reports.js";
import { Option } from "./option.js";
import { Owner } from "./owner.js";
import { Package, Packages } from "./packages.js";
import { Pathway, Stop } from "./pathway.js";
import { PerformanceTarget } from "./performance-target.js";
import { Phase } from "./phase.js";
import { PieChart, Slice } from "./pie-chart.js";
import { Plan } from "./plan.js";
import {
  Traceability,
  DecisionMatrix,
  RiskRegister,
  Scope,
  ActionItems,
  Estimate,
  DependencyPlan,
  RACI,
  Objectives,
  CapacityPlan,
  KeyResults,
} from "./planning-reports.js";
import { BoxPlot } from "./plot-box-plot.js";
import { BulletChart } from "./plot-bullet-chart.js";
import { BumpChart } from "./plot-bump-chart.js";
import { CalendarHeatmap } from "./plot-calendar-heatmap.js";
import { ChordDiagram } from "./plot-chord-diagram.js";
import { CohortTable } from "./plot-cohort-table.js";
import { ConfusionMatrix } from "./plot-confusion-matrix.js";
import { DotPlot } from "./plot-dot-plot.js";
import { DumbbellChart } from "./plot-dumbbell-chart.js";
import { ECDF } from "./plot-ecdf.js";
import { Heatmap } from "./plot-heatmap.js";
import { Histogram } from "./plot-histogram.js";
import { IntervalPlot } from "./plot-interval-plot.js";
import { ParetoChart } from "./plot-pareto-chart.js";
import { RidgelinePlot } from "./plot-ridgeline-plot.js";
import { SlopeChart } from "./plot-slope-chart.js";
import { Sunburst } from "./plot-sunburst.js";
import { UpSetPlot } from "./plot-up-set-plot.js";
import { ViolinPlot } from "./plot-violin-plot.js";
import { Pre } from "./pre.js";
import { Priority } from "./priority.js";
import { Prop, Props } from "./props.js";
import { Pin, Quadrant } from "./quadrant.js";
import {
  TestMatrix,
  Coverage,
  BenchmarkSuite,
  TestHistory,
  AccessibilityReport,
  ContractResults,
} from "./quality-reports.js";
import { Radar } from "./radar.js";
import { RecordItem } from "./record-item.js";
import { Commit, Issue, PR, Ref } from "./ref.js";
import {
  ApiParams,
  CliReference,
  ConfigReference,
  ErrorCatalog,
  CompatibilityMatrix,
  DeprecationTimeline,
} from "./reference-reports.js";
import { Entry, Release } from "./release.js";
import { Req, Reqs } from "./req.js";
import { ResearchClaim } from "./research-claim.js";
import { Comment, Review } from "./review.js";
import { Risk } from "./risk.js";
import { Link, Sankey } from "./sankey.js";
import { Point, Scatter } from "./scatter.js";
import { DbField, DbTable, Schema } from "./schema.js";
import { Score } from "./score.js";
import { Search, Searches } from "./search.js";
import {
  ImpactMap,
  DataLineage,
  SequenceDiagram,
  StateDiagram,
  Swimlane,
  Architecture,
  DecisionTree,
  MindMap,
  ServiceTopology,
  EntityRelations,
  DependencyMatrix,
  Flamegraph,
  BundleReport,
  QueryPlan,
} from "./semantic-diagrams.js";
import { Series } from "./series.js";
import { Severity } from "./severity.js";
import { shadcnComponents } from "./shadcn.js";
import { SmallMultiples } from "./small-multiples.js";
import { Spark } from "./spark.js";
import { Row, Stack } from "./stack.js";
import { Stat, Stats } from "./stats.js";
import { StatusBadge } from "./status-badge.js";
import { Day, Service, StatusPage, Uptime } from "./statuspage.js";
import { Step, Steps } from "./steps.js";
import {
  JsonDiff,
  ConfigDiff,
  ApiDiff,
  SchemaDiff,
  DatasetDiff,
} from "./structured-diff.js";
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
import { Verdict } from "./verdict.js";
import { Span, Waterfall } from "./waterfall.js";

export { Approval, Approvals } from "./approvals.js";
export { Ask, Choice, Question, QUESTION_TYPES } from "./ask.js";
export { Audit, Vuln } from "./audit.js";
export { Bar, BarChart } from "./bar-chart.js";
export { Bench, BENCH_BETTER, Benchmarks } from "./benchmarks.js";
export { Bridge, Delta } from "./bridge.js";
export { Bump, BUMP_KINDS, Bumps } from "./bumps.js";
export { Callout, CALLOUT_KINDS } from "./callout.js";
export { Change, CHANGE_KINDS, Changes } from "./changes.js";
export { Check, CHECK_STATUSES, Checks } from "./checks.js";
export { Cmd } from "./cmd.js";
export { Column, Columns } from "./columns.js";
export { Comments } from "./comments.js";
export { Board, BoardCard, Lane } from "./board.js";
export { After, Before } from "./compare.js";
export { Decision, DECISION_STATUSES } from "./decision.js";
export { PerformanceTarget } from "./performance-target.js";
export { ResearchClaim } from "./research-claim.js";
export { Dep, DEP_KINDS, Deps } from "./deps.js";
export { Details } from "./details.js";
export { DiffView, parseDiff } from "./diff.js";
export type { DiffCommentSpec, FileDiff } from "./diff.js";
export { DiffStat } from "./diffstat.js";
export { Due } from "./due.js";
export { Effort, EFFORT_SIZES } from "./effort.js";
export { Endpoint, Endpoints, HTTP_METHODS } from "./endpoints.js";
export { EnvVar, EnvVars } from "./envvars.js";
export { Figure } from "./figure.js";
export { FileRef } from "./file-ref.js";
export { File, FILE_KINDS, Files } from "./files.js";
export { CONFIDENCES, Finding, Findings } from "./findings.js";
export { Flow, FlowStep } from "./flow.js";
export { Funnel, Stage } from "./funnel.js";
export { Gantt, Milestone, Task } from "./gantt.js";
export { Gauge, GAUGE_TONES, Gauges } from "./gauges.js";
export { Glossary, Term } from "./glossary.js";
export { Edge, Graph, Node } from "./graph.js";
export { Cell, Grid } from "./grid.js";
export { Hypotheses, Hypothesis, HYPOTHESIS_STATUSES } from "./hypothesis.js";
export { hasIcon, Icon, normalizeIconName } from "./icon.js";
export { Incident, INCIDENT_STATUSES } from "./incident.js";
export { Del, Ins } from "./ins-del.js";
export { Json } from "./json.js";
export { LineChart } from "./line-chart.js";
export { Matrix } from "./matrix.js";
export { Meta, MetaItem } from "./meta.js";
export { Option, OPTION_STATUSES } from "./option.js";
export { Owner } from "./owner.js";
export { Package, PACKAGE_KINDS, Packages } from "./packages.js";
export { Pathway, Stop } from "./pathway.js";
export { Phase } from "./phase.js";
export { PieChart, Slice } from "./pie-chart.js";
export { Pin, Quadrant } from "./quadrant.js";
export { Plan, PlanHeader } from "./plan.js";
export { Pre } from "./pre.js";
export { Priority, PRIORITY_LEVELS } from "./priority.js";
export { Prop, Props } from "./props.js";
export { Radar } from "./radar.js";
export { Commit, Issue, PR, Ref } from "./ref.js";
export { Entry, ENTRY_KINDS, Release } from "./release.js";
export { Req, Reqs } from "./req.js";
export { Comment, Review, REVIEW_VERDICTS } from "./review.js";
export { Risk, RISK_LEVELS } from "./risk.js";
export { Link, Sankey } from "./sankey.js";
export { Point, Scatter } from "./scatter.js";
export { DbField, DbTable, Schema } from "./schema.js";
export { Score } from "./score.js";
export { Search, Searches } from "./search.js";
export { Series } from "./series.js";
export { isSeverity, Severity, SEVERITY_LEVELS } from "./severity.js";
export { Row, Stack } from "./stack.js";
export { Spark, SPARK_TONES } from "./spark.js";
export { Stat, Stats } from "./stats.js";
export { StatusBadge, STATUSES } from "./status-badge.js";
export {
  Day,
  DAY_STATUSES,
  Service,
  SERVICE_STATUSES,
  StatusPage,
  Uptime,
} from "./statuspage.js";
export { Step, Steps } from "./steps.js";
export { Summary } from "./summary.js";
export { SYMBOL_KINDS, SymbolRef } from "./symbol-ref.js";
export { TERMINAL_LANGS, Terminal } from "./terminal.js";
export {
  formatDuration,
  parseDuration,
  Test,
  TEST_STATUSES,
  Tests,
} from "./tests.js";
export { Event, Timeline } from "./timeline.js";
export { Toc } from "./toc.js";
export { FRAME_KINDS, Trace, TraceFrame } from "./trace.js";
export { Tree } from "./tree.js";
export { Tile, Treemap } from "./treemap.js";
export { Overlap, Set, Venn } from "./venn.js";
export { Verdict, VERDICTS } from "./verdict.js";
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
  AccessibilityReport,
  ActionItems,
  After,
  AlertRules,
  AnnotatedImage,
  AnswerSheet,
  ApiDiff,
  ApiExample,
  ApiParams,
  Approval,
  Approvals,
  Architecture,
  Ask,
  Assumptions,
  AudioTranscript,
  Audit,
  Bar,
  BarChart,
  Before,
  Bench,
  BenchmarkSuite,
  Benchmarks,
  Board,
  BoardCard,
  BoxPlot,
  Bridge,
  BulletChart,
  Bump,
  BumpChart,
  Bumps,
  BundleReport,
  Calculator,
  CalendarHeatmap,
  Callout,
  CapacityPlan,
  Cell,
  Change,
  Changes,
  Check,
  Checklist,
  Checks,
  Choice,
  ChordDiagram,
  Cite,
  CliReference,
  Cmd,
  CodeGroup,
  CodeWalkthrough,
  CohortTable,
  Column,
  Columns,
  Comment,
  Comments,
  Commit,
  CompatibilityMatrix,
  ConfigDiff,
  ConfigReference,
  ConfusionMatrix,
  ContractResults,
  Conversation,
  Coverage,
  CrossRef,
  DataLineage,
  DataTable,
  DataValidation,
  DatasetDiff,
  DatasetProfile,
  Day,
  DbField,
  DbTable,
  Decision,
  DecisionMatrix,
  DecisionTree,
  Del,
  Delta,
  Dep,
  DependencyMatrix,
  DependencyPlan,
  DeprecationTimeline,
  Deps,
  Details,
  DiffStat,
  DocumentHistory,
  DocumentSearch,
  DotPlot,
  DownloadData,
  Due,
  DumbbellChart,
  ECDF,
  Edge,
  Effort,
  Endpoint,
  Endpoints,
  EntityRelations,
  Entry,
  EnvVar,
  EnvVars,
  ErrorBudget,
  ErrorCatalog,
  Estimate,
  EvalCase,
  EvalReport,
  Event,
  Evidence,
  Experiment,
  FeatureFlags,
  Figure,
  File,
  FileRef,
  Files,
  FilterPanel,
  Finding,
  Findings,
  Flamegraph,
  Flow,
  FlowStep,
  Funnel,
  Gantt,
  Gauge,
  Gauges,
  Glossary,
  Graph,
  Grid,
  Heatmap,
  Histogram,
  Hypotheses,
  Hypothesis,
  Icon,
  ImageCompare,
  ImageGallery,
  ImpactMap,
  Incident,
  Include,
  Ins,
  IntervalPlot,
  Issue,
  JourneyMap,
  Json,
  JsonDiff,
  KeyResults,
  Lane,
  Limitations,
  LineChart,
  Link,
  Logs,
  MaintenanceWindow,
  Matrix,
  Meta,
  MetaItem,
  Milestone,
  MindMap,
  ModelComparison,
  Node,
  NumberedEquation,
  ObjectSchema,
  Objectives,
  Option,
  Overlap,
  Owner,
  PR,
  Package,
  PackageInstall,
  Packages,
  PageBreak,
  ParetoChart,
  Pathway,
  PdfPreview,
  PerformanceTarget,
  PermissionMatrix,
  Phase,
  PieChart,
  Pin,
  Plan,
  Point,
  PrintLayout,
  Priority,
  PromptTemplate,
  Proof,
  Prop,
  Props,
  Provenance,
  Quadrant,
  QueryPlan,
  Question,
  RACI,
  Radar,
  Ranking,
  RecordItem,
  RecoveryPlan,
  Ref,
  Release,
  Remediation,
  Reproduction,
  Req,
  Reqs,
  Request,
  ResearchClaim,
  Response,
  Review,
  RidgelinePlot,
  Risk,
  RiskRegister,
  Rollout,
  Row,
  Runbook,
  SLO,
  Sankey,
  Scatter,
  Schema,
  SchemaDiff,
  Scope,
  Score,
  Search,
  Searches,
  SequenceDiagram,
  Series,
  Service,
  ServiceTopology,
  Set,
  Severity,
  Sidenote,
  Slice,
  SlopeChart,
  SmallMultiples,
  Source,
  Sources,
  Span,
  Spark,
  Stack,
  Stage,
  Stat,
  StateDiagram,
  Stats,
  StatusBadge,
  StatusPage,
  Step,
  Steps,
  Stop,
  Summary,
  Sunburst,
  Swimlane,
  SymbolOutline,
  SymbolRef,
  SyncedTabs,
  TabItem,
  TableOfFigures,
  Task,
  Term,
  TermRef,
  Terminal,
  Test,
  TestHistory,
  TestMatrix,
  Tests,
  Theorem,
  ThreatModel,
  Tile,
  Timeline,
  Toc,
  TokenUsage,
  ToolCall,
  Trace,
  TraceFrame,
  Traceability,
  Tree,
  Treemap,
  UpSetPlot,
  Uptime,
  Venn,
  Verdict,
  Video,
  ViolinPlot,
  VisualDiff,
  Vuln,
  Waterfall,
  Wizard,
  pre: Pre,
  ...shadcnComponents,
};

export { DataTable, FilterPanel, DownloadData } from "./data-table.js";
export { RecordItem } from "./record-item.js";
export { JourneyMap } from "./diagrams-reports.js";
export {
  Checklist,
  Ranking,
  Calculator,
  Wizard,
  AnswerSheet,
  PromptTemplate,
  DocumentSearch,
} from "./document-inputs.js";
export {
  ImageGallery,
  AnnotatedImage,
  ImageCompare,
  VisualDiff,
  Video,
  AudioTranscript,
  PdfPreview,
  PrintLayout,
  PageBreak,
} from "./document-media.js";
export {
  Sources,
  Source,
  Cite,
  CrossRef,
  TermRef,
  Sidenote,
  Include,
  TableOfFigures,
  NumberedEquation,
  Theorem,
  Proof,
} from "./document-references.js";
export {
  CodeGroup,
  SyncedTabs,
  TabItem,
  PackageInstall,
  CodeWalkthrough,
  Request,
  Response,
  ApiExample,
  Conversation,
} from "./document-tabs.js";
export {
  EvalReport,
  ModelComparison,
  ToolCall,
  TokenUsage,
  DatasetProfile,
  DataValidation,
  Experiment,
  EvalCase,
} from "./evaluation-reports.js";
export {
  Evidence,
  Provenance,
  Assumptions,
  Limitations,
  DocumentHistory,
} from "./evidence-reports.js";
export { Reproduction, Logs, SymbolOutline } from "./investigation-reports.js";
export { ObjectSchema } from "./object-schema.js";
export {
  Runbook,
  Rollout,
  SLO,
  AlertRules,
  FeatureFlags,
  RecoveryPlan,
  PermissionMatrix,
  ThreatModel,
  Remediation,
  MaintenanceWindow,
  ErrorBudget,
} from "./operations-reports.js";
export {
  Traceability,
  DecisionMatrix,
  RiskRegister,
  Scope,
  ActionItems,
  Estimate,
  DependencyPlan,
  RACI,
  Objectives,
  CapacityPlan,
  KeyResults,
} from "./planning-reports.js";
export { BoxPlot } from "./plot-box-plot.js";
export { BulletChart } from "./plot-bullet-chart.js";
export { BumpChart } from "./plot-bump-chart.js";
export { CalendarHeatmap } from "./plot-calendar-heatmap.js";
export { ChordDiagram } from "./plot-chord-diagram.js";
export { CohortTable } from "./plot-cohort-table.js";
export { ConfusionMatrix } from "./plot-confusion-matrix.js";
export { DotPlot } from "./plot-dot-plot.js";
export { DumbbellChart } from "./plot-dumbbell-chart.js";
export { ECDF } from "./plot-ecdf.js";
export { Heatmap } from "./plot-heatmap.js";
export { Histogram } from "./plot-histogram.js";
export { IntervalPlot } from "./plot-interval-plot.js";
export { ParetoChart } from "./plot-pareto-chart.js";
export { RidgelinePlot } from "./plot-ridgeline-plot.js";
export { SlopeChart } from "./plot-slope-chart.js";
export { Sunburst } from "./plot-sunburst.js";
export { UpSetPlot } from "./plot-up-set-plot.js";
export { ViolinPlot } from "./plot-violin-plot.js";
export {
  TestMatrix,
  Coverage,
  BenchmarkSuite,
  TestHistory,
  AccessibilityReport,
  ContractResults,
} from "./quality-reports.js";
export {
  ApiParams,
  CliReference,
  ConfigReference,
  ErrorCatalog,
  CompatibilityMatrix,
  DeprecationTimeline,
} from "./reference-reports.js";
export {
  ImpactMap,
  DataLineage,
  SequenceDiagram,
  StateDiagram,
  Swimlane,
  Architecture,
  DecisionTree,
  MindMap,
  ServiceTopology,
  EntityRelations,
  DependencyMatrix,
  Flamegraph,
  BundleReport,
  QueryPlan,
} from "./semantic-diagrams.js";
export { SmallMultiples } from "./small-multiples.js";
export {
  JsonDiff,
  ConfigDiff,
  ApiDiff,
  SchemaDiff,
  DatasetDiff,
} from "./structured-diff.js";

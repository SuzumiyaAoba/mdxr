import { own } from "../guards.js";
import {
  isDataRecord as isRecord,
  columnsOf,
  dateValue,
  deviation,
  display,
  mean,
  numberValue,
  numbers,
  percentage,
  positive,
  quantile,
  records,
  rounded,
  uniqueIds,
  words,
} from "./data.js";
import type { DataRecord } from "./data.js";
import { equalData } from "./differences.js";

export interface ReportModel {
  rows: DataRecord[];
  summary: string;
  columns: string[];
}
export interface ReportSpec {
  description: string;
  fields: string;
  required?: string;
  prepare?: (rows: DataRecord[], options: DataRecord) => DataRecord[];
}

const countSummary = (rows: DataRecord[]): string => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const status = display(row.status);
    if (status) {
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
  }
  return [
    `${rows.length} entries`,
    ...[...counts].map(([status, n]) => `${n} ${status}`),
  ].join(" · ");
};

const traceability = (rows: DataRecord[]): DataRecord[] =>
  rows.map((row) => {
    const missing = ["tasks", "files", "tests"].filter(
      (key) => words(row[key]).length === 0
    );
    return {
      ...row,
      missing: missing.join(", "),
      status: missing.length ? "uncovered" : "covered",
    };
  });

const weighted = (rows: DataRecord[], options: DataRecord): DataRecord[] => {
  const weights = isRecord(options.weights) ? options.weights : {};
  if (!Object.keys(weights).length) {
    throw new Error(
      "DecisionMatrix: options.weights must name at least one criterion"
    );
  }
  const sum = Object.values(weights).reduce<number>(
    (total, value) => total + positive(value, "weight"),
    0
  );
  if (sum === 0) {
    throw new Error("DecisionMatrix: weights must have a positive total");
  }
  return rows
    .map((row) => ({
      ...row,
      score: rounded(
        Object.entries(weights).reduce(
          (total, [key, weight]) =>
            total + numberValue(row[key], key) * positive(weight, key),
          0
        ) / sum
      ),
    }))
    .toSorted((a, b) => b.score - a.score);
};

const risks = (rows: DataRecord[]): DataRecord[] =>
  rows
    .map((row) => ({
      ...row,
      exposure:
        positive(row.likelihood, "likelihood") * positive(row.impact, "impact"),
    }))
    .toSorted((a, b) => b.exposure - a.exposure);

const estimates = (rows: DataRecord[]): DataRecord[] =>
  rows.map((row) => {
    const low = positive(row.optimistic, "optimistic");
    const mid = positive(row.likely, "likely");
    const high = positive(row.pessimistic, "pessimistic");
    if (low > mid || mid > high) {
      throw new Error("Estimate: expected optimistic ≤ likely ≤ pessimistic");
    }
    return {
      ...row,
      deviation: rounded((high - low) / 6),
      expected: rounded((low + 4 * mid + high) / 6),
    };
  });

const schedule = (rows: DataRecord[]): DataRecord[] => {
  const byId = uniqueIds(rows);
  const finish = new Map<string, number>();
  const active = new Set<string>();
  const end = (id: string): number => {
    const known = finish.get(id);
    if (known !== undefined) {
      return known;
    }
    if (active.has(id)) {
      throw new Error(`DependencyPlan: cycle at ${id}`);
    }
    const row = byId.get(id);
    if (!row) {
      throw new Error(`DependencyPlan: unknown dependency ${id}`);
    }
    active.add(id);
    const start = Math.max(0, ...words(row.depends).map(end));
    const result = start + positive(row.duration, `${id}.duration`);
    finish.set(id, result);
    active.delete(id);
    return result;
  };
  for (const id of byId.keys()) {
    end(id);
  }
  const total = Math.max(0, ...finish.values());
  const dependents = new Map<string, DataRecord[]>();
  for (const row of rows) {
    for (const predecessor of words(row.depends)) {
      const siblings = dependents.get(predecessor) ?? [];
      siblings.push(row);
      dependents.set(predecessor, siblings);
    }
  }
  const latest = new Map<string, number>();
  const latestEnd = (id: string): number => {
    const cached = latest.get(id);
    if (cached !== undefined) {
      return cached;
    }
    const successors = dependents.get(id) ?? [];
    const value = successors.length
      ? Math.min(
          ...successors.map(
            (row) =>
              latestEnd(display(row.id)) - positive(row.duration, "duration")
          )
        )
      : total;
    latest.set(id, value);
    return value;
  };
  return rows.map((row) => {
    const id = display(row.id);
    const stop = finish.get(id) ?? 0;
    const slack = latestEnd(id) - stop;
    return {
      ...row,
      critical: Math.abs(slack) < 1e-9,
      end: stop,
      slack: rounded(slack),
      start: stop - positive(row.duration, "duration"),
    };
  });
};

const capacity = (rows: DataRecord[]): DataRecord[] =>
  rows.map((row) => {
    const available = positive(row.capacity, "capacity");
    const allocated = positive(row.allocated, "allocated");
    return {
      ...row,
      remaining: available - allocated,
      status: allocated > available ? "overloaded" : "available",
      utilization: percentage(allocated, available),
    };
  });

const benchmarks = (rows: DataRecord[]): DataRecord[] =>
  rows.map((row) => {
    const samples = numbers(row.samples, "samples");
    if (!samples.length) {
      throw new Error("BenchmarkSuite: each row needs samples");
    }
    const avg = mean(samples);
    const sd = deviation(samples);
    return {
      ...row,
      deviation: rounded(sd),
      max: Math.max(...samples),
      mean: rounded(avg),
      median: rounded(quantile(samples, 0.5)),
      min: Math.min(...samples),
      p95: rounded(quantile(samples, 0.95)),
      samples: samples.length,
      standardError: rounded(sd / Math.sqrt(samples.length)),
    };
  });

const history = (rows: DataRecord[]): DataRecord[] =>
  rows.map((row) => {
    const runs = words(row.runs);
    const pass = runs.filter((status) => status === "pass").length;
    return {
      ...row,
      attempts: runs.length,
      flaky: pass > 0 && pass < runs.length,
      passRate: percentage(pass, runs.length),
    };
  });

const coverage = (rows: DataRecord[]): DataRecord[] =>
  rows.map((row) => {
    const covered = positive(row.covered, "covered");
    const total = positive(row.total, "total");
    if (covered > total) {
      throw new Error("Coverage: covered cannot exceed total");
    }
    return {
      ...row,
      coverage: percentage(covered, total),
      uncovered: total - covered,
    };
  });

const slo = (rows: DataRecord[]): DataRecord[] =>
  rows.map((row) => {
    const target = numberValue(row.target, "target");
    const total = positive(row.total, "total");
    const bad = positive(row.bad, "bad");
    if (target < 0 || target > 100 || bad > total) {
      throw new Error("SLO: target must be 0–100 and bad ≤ total");
    }
    const budget = total * (1 - target / 100);
    const difference = budget - bad;
    // Percent-to-count conversion can land just below an exact budget.
    const remaining =
      Math.abs(difference) <= Number.EPSILON * total * 8 ? 0 : difference;
    return {
      ...row,
      achieved: percentage(total - bad, total),
      budget: rounded(budget),
      consumed: percentage(bad, budget),
      remaining: rounded(remaining),
      status: remaining >= 0 ? "pass" : "fail",
    };
  });

const tokenUsage = (rows: DataRecord[]): DataRecord[] =>
  rows.map((row) => {
    const input = positive(row.input, "input", 0);
    const cached = positive(row.cached, "cached", 0);
    const output = positive(row.output, "output", 0);
    if (cached > input) {
      throw new Error("TokenUsage: cached tokens are a subset of input");
    }
    const cost =
      ((input - cached) * positive(row.inputRate, "inputRate", 0) +
        cached * positive(row.cacheRate, "cacheRate", 0) +
        output * positive(row.outputRate, "outputRate", 0)) /
      1_000_000;
    return { ...row, cost: Number(cost.toFixed(6)), total: input + output };
  });

const datasetProfile = (rows: DataRecord[]): DataRecord[] =>
  columnsOf(rows).map((column) => {
    const values = rows.map((row) => own(row, column));
    const present = values.filter(
      (value) => value !== undefined && value !== null && value !== ""
    );
    const numeric = present.filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value)
    );
    return {
      column,
      max: numeric.length ? Math.max(...numeric) : "",
      mean: numeric.length ? rounded(mean(numeric)) : "",
      min: numeric.length ? Math.min(...numeric) : "",
      missing: values.length - present.length,
      missingRate: percentage(values.length - present.length, values.length),
      rows: rows.length,
      types: [
        ...new Set(
          present.map((value) =>
            Array.isArray(value) ? "array" : typeof value
          )
        ),
      ].join(", "),
      unique: new Set(present.map(display)).size,
    };
  });

const DATA_TYPES = new Map<string, (value: unknown) => boolean>([
  ["array", Array.isArray],
  ["boolean", (value) => typeof value === "boolean"],
  ["integer", (value) => Number.isInteger(value)],
  ["null", (value) => value === null],
  ["number", (value) => typeof value === "number" && Number.isFinite(value)],
  ["object", isRecord],
  ["string", (value) => typeof value === "string"],
]);

const withinBounds = (
  value: unknown,
  min: number | undefined,
  max: number | undefined
): boolean => {
  if (min === undefined && max === undefined) {
    return true;
  }
  try {
    const numeric = numberValue(value);
    return (
      (min === undefined || numeric >= min) &&
      (max === undefined || numeric <= max)
    );
  } catch {
    return false;
  }
};

const validateDataset = (
  rows: DataRecord[],
  options: DataRecord
): DataRecord[] => {
  const rules = records(options.rules ?? [], "options.rules");
  return rules.map((rule) => {
    const key = display(rule.field);
    const checkType = DATA_TYPES.get(display(rule.type));
    if (rule.type !== undefined && checkType === undefined) {
      throw new TypeError(
        `DataValidation: unsupported type ${display(rule.type)}`
      );
    }
    const min =
      rule.min === undefined ? undefined : numberValue(rule.min, "min");
    const max =
      rule.max === undefined ? undefined : numberValue(rule.max, "max");
    if (min !== undefined && max !== undefined && min > max) {
      throw new RangeError("DataValidation: min cannot exceed max");
    }
    const matches = rows.flatMap((row, i) => {
      const value = own(row, key);
      const empty = value === null || value === undefined || value === "";
      const wrongType = !empty && checkType !== undefined && !checkType(value);
      const outOfBounds = !empty && !withinBounds(value, min, max);
      const outside =
        !empty && Array.isArray(rule.enum) && !rule.enum.includes(value);
      return (Boolean(rule.required) && empty) ||
        wrongType ||
        outOfBounds ||
        outside
        ? [i + 1]
        : [];
    });
    return {
      field: key,
      rows: matches.join(", "),
      rule: display(rule.name) || display(rule),
      status: matches.length ? "fail" : "pass",
      violations: matches.length,
    };
  });
};

const evaluation = (rows: DataRecord[]): DataRecord[] =>
  rows.map((row) => ({
    ...row,
    status:
      row.status ?? (equalData(row.expected, row.actual) ? "pass" : "fail"),
  }));

const experiment = (rows: DataRecord[]): DataRecord[] =>
  rows.map((row) => {
    const count = positive(row.count, "count");
    const success = positive(row.successes, "successes");
    if (!Number.isInteger(count) || !Number.isInteger(success)) {
      throw new TypeError("Experiment: count and successes must be integers");
    }
    if (success > count) {
      throw new Error("Experiment: successes cannot exceed count");
    }
    if (count === 0) {
      return { ...row, lower95: "—", rate: "—", upper95: "—" };
    }
    const p = success / count;
    const z = 1.959963984540054;
    const divisor = 1 + (z * z) / count;
    const center = (p + (z * z) / (2 * count)) / divisor;
    const spread =
      (z * Math.sqrt((p * (1 - p)) / count + (z * z) / (4 * count * count))) /
      divisor;
    return {
      ...row,
      lower95: percentage(center - spread, 1),
      rate: percentage(success, count),
      upper95: percentage(center + spread, 1),
    };
  });

const ratios = (rows: DataRecord[]): DataRecord[] =>
  rows.map((row) => {
    const current = numberValue(row.current, "current");
    const base = numberValue(row.baseline, "baseline", 0);
    const target = numberValue(row.target, "target");
    return { ...row, progress: percentage(current - base, target - base) };
  });

const timeWindows = (rows: DataRecord[]): DataRecord[] =>
  rows.map((row) => {
    const start = dateValue(row.start, "start");
    const end = dateValue(row.end, "end");
    if (end < start) {
      throw new Error("MaintenanceWindow: end must follow start");
    }
    return { ...row, durationMinutes: rounded((end - start) / 60_000) };
  });

const testMatrix = (rows: DataRecord[], options: DataRecord): DataRecord[] => {
  if (!isRecord(options.axes)) {
    return rows;
  }
  let combinations: DataRecord[] = [{}];
  for (const [axis, values] of Object.entries(options.axes)) {
    if (combinations.length * words(values).length > 10_000) {
      throw new Error("TestMatrix: too many combinations");
    }
    combinations = combinations.flatMap((combination) =>
      words(values).map((value) => ({ ...combination, [axis]: value }))
    );
  }
  if (combinations.length > 10_000) {
    throw new Error("TestMatrix: at most 10000 combinations are supported");
  }
  return combinations.map(
    (combination) =>
      rows.find((row) =>
        Object.entries(combination).every(
          ([key, value]) => display(row[key]) === value
        )
      ) ?? { ...combination, status: "not-run" }
  );
};

export const REPORT_SPECS: Record<string, ReportSpec> = {
  AccessibilityReport: {
    description:
      "Accessibility findings with rule, affected element, severity and fix.",
    fields: "rule,element,severity,description,fix,status",
  },
  ActionItems: {
    description:
      "Actions with owner, deadline, acceptance criteria and completion evidence.",
    fields: "action,owner,due,acceptance,evidence,status",
  },
  AlertRules: {
    description:
      "Alert thresholds, evaluation duration, owner and linked response procedure.",
    fields: "name,metric,condition,duration,owner,runbook",
  },
  ApiParams: {
    description:
      "Request parameters by location, type, required flag, constraints and example.",
    fields: "name,in,type,required,default,constraints,example,description",
  },
  Assumptions: {
    description:
      "Assumptions with verification state, owner and review trigger.",
    fields: "assumption,status,owner,evidence,revisit",
  },
  BenchmarkSuite: {
    description:
      "Repeated samples: mean, median, p95, sample deviation and standard error.",
    fields:
      "name,samples,mean,median,p95,min,max,deviation,standardError,unit,environment",
    prepare: benchmarks,
  },
  CapacityPlan: {
    description:
      "Capacity, allocation, remaining effort and overload by person or team.",
    fields: "owner,period,capacity,allocated,remaining,utilization,status",
    prepare: capacity,
  },
  CliReference: {
    description:
      "Commands, positional arguments, flags, defaults and usage examples.",
    fields: "command,argument,flag,type,default,conflicts,example,description",
  },
  CompatibilityMatrix: {
    description:
      "Platform/runtime/version compatibility with supporting evidence.",
    fields: "platform,runtime,version,status,notes",
  },
  ConfigReference: {
    description:
      "Configuration keys, environment and CLI overrides, precedence and defaults.",
    fields: "key,type,default,env,flag,precedence,description",
  },
  ContractResults: {
    description:
      "Provider/consumer contract expectations and actual test outcomes.",
    fields: "provider,consumer,contract,expected,actual,status",
    prepare: evaluation,
  },
  Coverage: {
    description:
      "Covered/total observations, coverage rate and uncovered count.",
    fields: "file,kind,covered,total,coverage,uncovered,lines",
    prepare: coverage,
  },
  DataValidation: {
    description:
      "Data validation by field rules (required/type/min/max/enum) in options.rules.",
    fields: "field,rule,violations,rows,status",
    prepare: validateDataset,
  },
  DatasetProfile: {
    description:
      "Per-column types, missingness, uniqueness and numeric summaries.",
    fields: "column,rows,missing,missingRate,unique,types,min,max,mean",
    prepare: datasetProfile,
  },
  DecisionMatrix: {
    description:
      "Weighted criteria comparison; options.weights maps criteria to nonnegative weights.",
    fields: "name,score",
    prepare: weighted,
    required: "name",
  },
  DependencyPlan: {
    description:
      "Task dependencies, earliest schedule, slack and critical path; rejects cycles.",
    fields: "id,depends,duration,start,end,slack,critical",
    prepare: schedule,
  },
  DeprecationTimeline: {
    description:
      "Deprecation and removal milestones linked to replacement and migration.",
    fields: "feature,deprecated,removal,replacement,migration",
  },
  DocumentHistory: {
    description:
      "Document revisions, authors, reasons and superseding versions.",
    fields: "version,date,author,reason,supersededBy",
  },
  ErrorBudget: {
    description:
      "Remaining error budget and consumption over a declared measurement window.",
    fields: "service,window,target,total,bad,budget,remaining,consumed,status",
    prepare: slo,
  },
  ErrorCatalog: {
    description: "Error codes, causes, recovery actions and retry guidance.",
    fields: "code,message,cause,action,retry,href",
  },
  Estimate: {
    description: "Three-point PERT estimates and standard deviations.",
    fields: "name,optimistic,likely,pessimistic,expected,deviation,unit",
    prepare: estimates,
  },
  EvalCase: {
    description:
      "One or more evaluation cases with explicit expected and actual outputs.",
    fields: "name,input,expected,actual,rubric,status",
    prepare: evaluation,
  },
  EvalReport: {
    description:
      "Evaluation cases with inputs, expected/actual output, rubric and verdict.",
    fields: "name,input,expected,actual,rubric,score,status",
    prepare: evaluation,
  },
  Evidence: {
    description:
      "Evidence with source, revision, capture time and environment.",
    fields: "claim,source,captured,commit,environment,result",
  },
  Experiment: {
    description:
      "Binomial experiment results with Wilson 95% intervals; does not infer a winner.",
    fields: "variant,count,successes,rate,lower95,upper95,condition",
    prepare: experiment,
  },
  FeatureFlags: {
    description:
      "Feature flag state, targeting, ownership and retirement across environments.",
    fields: "flag,environment,enabled,condition,owner,retire",
  },
  JourneyMap: {
    description:
      "Journey stages, user actions, touchpoints, pain points and improvements.",
    fields: "stage,action,touchpoint,pain,improvement",
  },
  KeyResults: {
    description: "Baseline, target and current value with calculated progress.",
    fields: "name,baseline,current,target,progress",
    prepare: ratios,
  },
  Limitations: {
    description: "Scope and measurement limitations with their consequences.",
    fields: "limitation,scope,consequence,followup",
  },
  Logs: {
    description: "Searchable timestamped log entries by level and source.",
    fields: "time,level,source,message",
  },
  MaintenanceWindow: {
    description:
      "Maintenance windows with affected services, explicit time zones and duration.",
    fields: "service,start,end,durationMinutes,impact,recovery",
    prepare: timeWindows,
  },
  ModelComparison: {
    description:
      "Model results under a shared task, with quality, latency, cost and failures.",
    fields: "model,task,quality,latency,cost,failures,notes",
  },
  Objectives: {
    description: "Objectives linked to measurable key results and owners.",
    fields: "objective,keyResults,owner,due,status",
  },
  PermissionMatrix: {
    description: "Role/resource/action permissions and conditions.",
    fields: "role,resource,action,allowed,condition",
  },
  Provenance: {
    description: "Reproducible report inputs, tools, versions and settings.",
    fields: "input,tool,version,config,hash,generated",
  },
  RACI: {
    description:
      "Responsibility assignment: responsible, accountable, consulted, informed.",
    fields: "task,responsible,accountable,consulted,informed",
    required: "task,accountable",
  },
  RecoveryPlan: {
    description:
      "Recovery order, dependencies, RPO/RTO, backups and verification.",
    fields: "step,depends,service,rpo,rto,backup,action,verification",
  },
  Remediation: {
    description:
      "Vulnerability remediation with owner, due date, fix and verification evidence.",
    fields: "vulnerability,severity,owner,due,fix,verification,status",
  },
  Reproduction: {
    description:
      "Bug reproduction: environment, prerequisite, action, expected and actual results.",
    fields: "step,environment,prerequisite,action,expected,actual",
  },
  RiskRegister: {
    description:
      "Risks ordered by likelihood × impact, with owners and mitigation.",
    fields: "name,likelihood,impact,exposure,owner,mitigation,status",
    prepare: risks,
  },
  Rollout: {
    description:
      "Rollout stages, exposure, metrics, promotion gates and rollback conditions.",
    fields: "stage,target,percent,metric,gate,rollback,status",
  },
  Runbook: {
    description:
      "Operational steps with prerequisites, commands, expected results, stop and recovery conditions.",
    fields: "step,prerequisite,command,expected,stop,recovery",
  },
  SLO: {
    description:
      "Service objective and error budget from target percentage, total and bad events.",
    fields:
      "service,window,target,total,bad,achieved,budget,remaining,consumed,status",
    prepare: slo,
  },
  Scope: {
    description: "Included, excluded and deferred scope with rationale.",
    fields: "item,scope,reason,phase",
  },
  SymbolOutline: {
    description:
      "Symbol paths, kinds, signatures, parents and source locations.",
    fields: "name,kind,parent,signature,file,lines",
  },
  TestHistory: {
    description: "Run history, pass rate and flaky classification.",
    fields: "name,runs,attempts,passRate,flaky,retries",
    prepare: history,
  },
  TestMatrix: {
    description:
      "Test combinations with missing runs; options.axes enumerates the expected axes.",
    fields: "name,environment,version,status,duration",
    prepare: testMatrix,
  },
  ThreatModel: {
    description: "Assets, threats, attack paths, controls and residual risks.",
    fields: "asset,threat,path,control,residual,owner",
  },
  TokenUsage: {
    description:
      "Token totals and costs using explicit per-million input/cache/output rates; cached is included in input.",
    fields:
      "model,input,cached,output,total,inputRate,cacheRate,outputRate,cost",
    prepare: tokenUsage,
  },
  ToolCall: {
    description:
      "Tool calls including arguments, result, elapsed time and outcome.",
    fields: "tool,arguments,result,duration,status",
  },
  Traceability: {
    description:
      "Requirement → tasks → files → tests coverage with missing links.",
    fields: "id,requirement,tasks,files,tests,missing,status",
    prepare: traceability,
    required: "id",
  },
};

export const reportModel = (
  name: string,
  input: DataRecord[],
  options: DataRecord = {}
): ReportModel => {
  const spec = own(REPORT_SPECS, name);
  if (!(spec !== undefined)) {
    throw new Error(`Unknown report ${name}`);
  }
  for (const row of input) {
    for (const key of words(spec.required)) {
      if (!display(row[key])) {
        throw new Error(`${name}: ${key} is required on each row`);
      }
    }
  }
  const rows = spec.prepare ? spec.prepare(input, options) : input;
  const available = new Set(columnsOf(rows));
  const columns = [
    ...new Set([
      ...words(spec.fields).filter((key) => available.has(key)),
      ...available,
    ]),
  ];
  return { columns, rows, summary: countSummary(rows) };
};

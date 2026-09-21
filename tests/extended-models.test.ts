import { describe, expect, it } from "vitest";

import { calculate } from "../src/extended/calculator.js";
import {
  csvOf,
  dateValue,
  numberValue,
  parseCsv,
  parseJson,
  quantile,
  readRecords,
} from "../src/extended/data.js";
import { diagramModel, flameModel } from "../src/extended/diagrams.js";
import {
  differenceModel,
  equalData,
  jsonDifference,
  resolveConfig,
} from "../src/extended/differences.js";
import { plotModel } from "../src/extended/plots.js";
import { reportModel } from "../src/extended/reports.js";

describe("structured data and differences", () => {
  it("round-trips CSV quotes, commas, newlines, empty cells and Unicode", () => {
    const rows = [
      { empty: "", name: '日本語, "quoted"', note: "line one\nline two" },
    ];
    expect(readRecords(csvOf(rows), "csv")).toStrictEqual(rows);
    expect(parseCsv('\uFEFFname,value\r\n"a,b","x""y"\r\n')).toStrictEqual([
      ["name", "value"],
      ["a,b", 'x"y'],
    ]);
    expect(() => parseCsv('a\n"unfinished')).toThrow("unterminated");
    expect(() => readRecords("a,a\n1,2", "csv")).toThrow("unique");
  });

  it("rejects non-finite or blank numbers and invalid ISO dates", () => {
    for (const value of [" ", "NaN", Infinity, true, {}]) {
      expect(() => numberValue(value)).toThrow("finite number");
    }
    expect(dateValue("2024-02-29")).toBe(Date.UTC(2024, 1, 29));
    expect(() => dateValue("2025-02-29")).toThrow("ISO");
    expect(() => dateValue("yesterday")).toThrow("ISO");
  });

  it("preserves missing/null distinctions and escaped JSON Pointer keys", () => {
    expect(
      jsonDifference({ "a/b": null }, { "a/b": null, "x~y": null })
    ).toStrictEqual([{ after: null, change: "added", path: "/x~0y" }]);
    expect(jsonDifference({ "a/b": 1 }, {})).toStrictEqual([
      { before: 1, change: "removed", path: "/a~1b" },
    ]);
    expect(
      equalData({ a: 1, b: [null] }, parseJson('{"b":[null],"a":1}'))
    ).toBeTruthy();
    expect(
      differenceModel(
        "DatasetDiff",
        [
          { id: "a", n: 1 },
          { id: "b", n: 2 },
        ],
        [
          { id: "b", n: 3 },
          { id: "a", n: 1 },
        ]
      )
    ).toStrictEqual([
      { after: 3, before: 2, change: "changed", id: "b", path: "/n" },
    ]);
    expect(() =>
      differenceModel("DatasetDiff", [{ id: "a" }, { id: "a" }], [])
    ).toThrow("unique");
  });

  it("tracks configuration override sources without mutating prototypes", () => {
    const result = resolveConfig([
      { name: "default", values: { retries: 1 } },
      {
        name: "production",
        values: parseJson('{"retries":4,"__proto__":{"polluted":true}}'),
      },
    ]);
    expect(result.values.retries).toBe(4);
    expect(result.sources.retries).toBe("production");
    expect(Object.getPrototypeOf(result.values)).toBe(Object.prototype);
    expect(Object.hasOwn(result.values, "__proto__")).toBeTruthy();
  });
});

describe("computed report models", () => {
  it("computes critical paths with parallel tasks and rejects cycles/missing dependencies", () => {
    const result = reportModel("DependencyPlan", [
      { duration: 2, id: "a" },
      { depends: "a", duration: 5, id: "b" },
      { depends: "a", duration: 2, id: "c" },
      { depends: "b,c", duration: 1, id: "d" },
    ]);
    expect(result.rows).toMatchObject([
      { critical: true, end: 2, start: 0 },
      { critical: true, end: 7, start: 2 },
      { critical: false, end: 4, slack: 3, start: 2 },
      { critical: true, end: 8, start: 7 },
    ]);
    expect(() =>
      reportModel("DependencyPlan", [{ depends: "a", duration: 1, id: "a" }])
    ).toThrow("cycle");
    expect(() =>
      reportModel("DependencyPlan", [
        { depends: "missing", duration: 1, id: "a" },
      ])
    ).toThrow("unknown dependency");
  });

  it("calculates weighted decisions, PERT, coverage and cached-token costs", () => {
    expect(
      reportModel("DecisionMatrix", [{ cost: 2, name: "A", quality: 4 }], {
        weights: { cost: 1, quality: 3 },
      }).rows[0]?.score
    ).toBe(3.5);
    expect(
      reportModel("Estimate", [
        { likely: 4, name: "A", optimistic: 2, pessimistic: 6 },
      ]).rows[0]?.expected
    ).toBe(4);
    expect(() =>
      reportModel("Estimate", [
        { likely: 4, name: "A", optimistic: 5, pessimistic: 6 },
      ])
    ).toThrow("optimistic");
    expect(() =>
      reportModel("Coverage", [{ covered: 2, name: "A", total: 1 }])
    ).toThrow("exceed");
  });

  it("calculates cached token costs", () => {
    expect(
      reportModel("TokenUsage", [
        {
          cacheRate: 0.2,
          cached: 500,
          input: 1000,
          inputRate: 2,
          output: 100,
          outputRate: 10,
        },
      ]).rows[0]
    ).toMatchObject({ cost: 0.0021, total: 1100 });
    expect(() => reportModel("TokenUsage", [{ cached: 2, input: 1 }])).toThrow(
      "subset"
    );
  });

  it("reports absent test combinations, invalid fields and unbiased object equality", () => {
    const matrix = reportModel(
      "TestMatrix",
      [{ os: "linux", runtime: "22", status: "pass" }],
      { axes: { os: ["linux", "mac"], runtime: ["22", "24"] } }
    );
    expect(matrix.rows).toHaveLength(4);
    expect(matrix.rows.filter((row) => row.status === "not-run")).toHaveLength(
      3
    );
    const validation = reportModel(
      "DataValidation",
      [{ age: "bad" }, { age: -1 }, { age: 20 }],
      { rules: [{ field: "age", min: 0, required: true, type: "number" }] }
    );
    expect(validation.rows[0]).toMatchObject({
      rows: "1, 2",
      status: "fail",
      violations: 2,
    });
    expect(
      reportModel("EvalReport", [
        { actual: parseJson('{"b":2,"a":1}'), expected: { a: 1, b: 2 } },
      ]).rows[0]?.status
    ).toBe("pass");
  });

  it("handles zero denominators and binomial uncertainty explicitly", () => {
    expect(() =>
      reportModel("Experiment", [{ count: 10, successes: 1.5 }])
    ).toThrow("integers");
    expect(
      reportModel("Experiment", [{ count: 0, successes: 0 }]).rows[0]?.rate
    ).toBe("—");
    const [row] = reportModel("Experiment", [
      { count: 100, successes: 50 },
    ]).rows;
    expect(row?.rate).toBe("50%");
    expect(Number(String(row?.lower95).replace("%", ""))).toBeCloseTo(
      40.383,
      1
    );
    expect(Number(String(row?.upper95).replace("%", ""))).toBeCloseTo(
      59.617,
      1
    );
  });

  it("handles safe calculator operations", () => {
    expect(calculate("ratio", [2, 0])).toBeUndefined();
    expect(calculate("weighted", [2, 3], [10, 2])).toBe(26);
  });

  it("reports malformed bounded data and distinguishes array, object and integer types", () => {
    const result = reportModel(
      "DataValidation",
      [
        { age: "invalid", count: 1, items: [], metadata: {} },
        { age: -1, count: 1.5, items: {}, metadata: [] },
        { age: "20", count: 2, items: [], metadata: {} },
      ],
      {
        rules: [
          { field: "age", max: 100, min: 0 },
          { field: "items", type: "array" },
          { field: "metadata", type: "object" },
          { field: "count", type: "integer" },
        ],
      }
    );
    expect(
      result.rows.map(({ rows, violations }) => ({ rows, violations }))
    ).toStrictEqual([
      { rows: "1, 2", violations: 2 },
      { rows: "2", violations: 1 },
      { rows: "2", violations: 1 },
      { rows: "2", violations: 1 },
    ]);
    expect(() =>
      reportModel("DataValidation", [], {
        rules: [{ field: "age", type: "unknown" }],
      })
    ).toThrow("unsupported type");
  });
});

describe("statistical and graph geometry", () => {
  it("aggregates confusion counts and computes precision, recall and F1 per class", () => {
    const model = plotModel("ConfusionMatrix", [
      { actual: "positive", count: 35, predicted: "positive" },
      { actual: "positive", count: 5, predicted: "positive" },
      { actual: "positive", count: 10, predicted: "negative" },
      { actual: "negative", count: 5, predicted: "positive" },
      { actual: "negative", count: 45, predicted: "negative" },
      { actual: "unknown", count: 0, predicted: "unknown" },
    ]);
    expect(model.rows).toHaveLength(9);
    expect(model.summary).toBe("Accuracy 85% · 100 samples");
    expect(model.metrics?.[0]).toMatchObject({
      class: "positive",
      f1: "84.211%",
      precision: "88.889%",
      recall: "80%",
      support: 50,
    });
    expect(model.metrics?.[2]).toMatchObject({
      f1: "—",
      precision: "—",
      recall: "—",
      support: 0,
    });
  });

  it("uses R7 quantiles, Tukey outliers and inclusive final histogram bins", () => {
    expect(quantile([1, 2, 3, 4], 0.25)).toBe(1.75);
    const box = plotModel("BoxPlot", [
      { name: "A", values: [1, 2, 3, 4, 5, 20] },
    ]);
    expect(box.rows[0]).toMatchObject({
      max: 5,
      median: 3.5,
      min: 1,
      outliers: [20],
      q1: 2.25,
      q3: 4.75,
    });
    const histogram = plotModel("Histogram", [{ values: [0, 1, 2, 3, 4, 5] }], {
      bins: 2,
      max: 4,
      min: 0,
    });
    expect(histogram.rows.map((row) => row.count)).toStrictEqual([2, 3]);
    expect(histogram.summary).toContain("1 outside range");
    expect(plotModel("ECDF", [{ values: [1, 1, 2, 3] }]).rows).toStrictEqual([
      { cumulative: 0.5, value: 1 },
      { cumulative: 0.75, value: 2 },
      { cumulative: 1, value: 3 },
    ]);
  });

  it("keeps empty and constant distributions finite and rejects invalid hierarchies", () => {
    for (const name of [
      "Histogram",
      "ECDF",
      "ViolinPlot",
      "RidgelinePlot",
      "BoxPlot",
    ] as const) {
      for (const rows of [[], [{ name: "A", values: [2, 2, 2] }]]) {
        expect(JSON.stringify(plotModel(name, rows))).not.toMatch(
          /NaN|Infinity/u
        );
      }
    }
    expect(() =>
      plotModel("Sunburst", [
        { id: "a", parent: "b" },
        { id: "b", parent: "a" },
      ])
    ).toThrow(/cyclic|expected|child/iu);
    expect(() =>
      plotModel("IntervalPlot", [{ high: 2, low: 8, name: "A", value: 4 }])
    ).toThrow(/cyclic|expected|child/iu);
  });

  it("propagates impact along edges and computes exclusive flame times", () => {
    const nodes = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const edges = [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ];
    expect(
      diagramModel("ImpactMap", nodes, edges, { changed: ["b"] }).rows.map(
        (row) => row.affected
      )
    ).toStrictEqual([false, true, true]);
    expect(() =>
      diagramModel("Architecture", nodes, [{ from: "a", to: "missing" }])
    ).toThrow("unknown");
    const flame = flameModel([
      { id: "root", value: 10 },
      { id: "child", parent: "root", value: 4 },
    ]);
    expect(flame.rows[0]).toMatchObject({ self: 6 });
    expect(() =>
      flameModel([
        { id: "root", value: 1 },
        { id: "child", parent: "root", value: 2 },
      ])
    ).toThrow(/cyclic|expected|child/iu);
  });
});

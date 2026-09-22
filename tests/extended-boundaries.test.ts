import { describe, expect, it } from "vitest";

import { csvOf, rounded } from "../src/extended/data.js";
import { diagramModel } from "../src/extended/diagrams.js";
import { schemaRows } from "../src/extended/differences.js";
import { plotModel } from "../src/extended/plots.js";
import { dependencyMatrixModel } from "../src/extended/profiles.js";
import { reportModel } from "../src/extended/reports.js";

describe("extended component boundaries", () => {
  it("keeps constant large heatmap colors finite", () => {
    const model = plotModel("Heatmap", [{ value: 1e20, x: "a", y: "b" }]);
    expect(JSON.stringify(model.marks)).not.toMatch(/NaN|Infinity/u);
  });

  it("keeps extreme finite comparison coordinates finite", () => {
    const model = plotModel("DotPlot", [
      { name: "low", value: -1e308 },
      { name: "high", value: 1e308 },
    ]);
    const coordinates = model.marks.flatMap((mark) =>
      Object.values(mark).filter(
        (value): value is number => typeof value === "number"
      )
    );
    for (const coordinate of coordinates) {
      expect(Number.isFinite(coordinate)).toBeTruthy();
    }
  });

  it("preserves small histogram boundaries", () => {
    const model = plotModel(
      "Histogram",
      [{ values: [0.00001, 0.00002, 0.00003] }],
      { bins: 2 }
    );
    expect(model.rows[0]?.from).toBeCloseTo(0.00001, 10);
    expect(model.rows[1]?.to).toBeCloseTo(0.00003, 10);
  });

  it("renders empty ECDF observations without an invalid range", () => {
    expect(plotModel("ECDF", [{ values: [] }])).toMatchObject({
      marks: [],
      rows: [],
      summary: "No observations",
    });
  });

  it("does not overflow while rounding a finite value", () => {
    expect(rounded(1e308)).toBe(1e308);
  });

  it("handles an SLO exactly at its error budget", () => {
    expect(
      reportModel("SLO", [{ bad: 1, target: 99.9, total: 1000 }]).rows[0]
        ?.status
    ).toBe("pass");
    expect(
      reportModel("SLO", [{ bad: 2, target: 99.9, total: 1000 }]).rows[0]
        ?.status
    ).toBe("fail");
  });

  it("tracks required schema properties whose names contain dots", () => {
    const rows = schemaRows({
      properties: { "a.b": { type: "string" } },
      required: ["a.b"],
      type: "object",
    });
    expect(rows).toMatchObject([{ path: "a.b", required: true }]);
  });

  it("treats inherited property names as missing data", () => {
    expect(csvOf([{}], ["__proto__"])).toBe('"__proto__"\r\n""');
    const model = reportModel("DatasetProfile", [
      { constructor: "provided" },
      {},
    ]);
    expect(model.rows[0]).toMatchObject({
      column: "constructor",
      missing: 1,
      types: "string",
    });
  });

  it("normalizes numeric ids in dependency matrices", () => {
    const model = dependencyMatrixModel([{ from: 1, to: 2, value: 3 }]);
    expect(
      model.rows.find((row) => row.y === "1" && row.x === "2")?.value
    ).toBe(3);
  });

  it("treats an empty diagram group as ungrouped", () => {
    const model = diagramModel("Architecture", [{ group: "", id: "a" }], []);
    const ungrouped = diagramModel("Architecture", [{ id: "a" }], []);
    expect(model.marks).toStrictEqual(ungrouped.marks);
  });
});

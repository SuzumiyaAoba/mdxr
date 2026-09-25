import { describe, expect, it } from "vitest";

import { mdxToAscii } from "../src/ascii/index.js";
import { catalogEntries } from "../src/catalog.js";
import { renderDoc } from "./helpers.js";

const SOURCE =
  '<Sources><Source id="manual" title="Official manual" href="https://example.com/manual" /></Sources>';
const TARGET =
  'name="Input latency" target="50" unit="ms" statistic="p95" conditions="Stub provider; Apple Silicon"';

describe("research reporting", () => {
  it("resolves claim citations, dates and backlinks in HTML and text", async () => {
    const source = `<ResearchClaim id="claim" kind="documented" source="manual" checked="2026-09-25" title="Execution boundary">The runtime owns execution.</ResearchClaim>\n\n<Cite source="manual" />\n\n${SOURCE}`;
    const { body } = await renderDoc(source);
    const { markdown, warnings } = await mdxToAscii(source);
    for (const output of [body, markdown]) {
      const required = [
        "Documented",
        "2026-09-25",
        "#manual",
        'id="mdxr-citation-1"',
        'id="claim"',
        "The runtime owns execution.",
      ];
      expect(required.filter((value) => !output.includes(value))).toStrictEqual(
        []
      );
    }
    expect(body).toContain('href="#mdxr-citation-1"');
    expect(body).toContain('href="#mdxr-citation-2"');
    expect(warnings).toStrictEqual([]);
  });

  it.each(["proposal", "unknown"])(
    "allows %s without inventing evidence",
    async (kind) => {
      const source = `<ResearchClaim kind="${kind}">Needs an experiment.</ResearchClaim>`;
      const { body } = await renderDoc(source);
      const { markdown } = await mdxToAscii(source);
      expect(body).not.toContain("Source <");
      expect(markdown).not.toContain("Source:");
      expect(markdown).toContain("Needs an experiment.");
    }
  );

  it.each([
    [
      '<ResearchClaim kind="proposal" id=" spaced ">Invalid reference</ResearchClaim>',
      "id without whitespace",
    ],
    [
      '<ResearchClaim kind="documented" checked="2026-09-25">Missing source</ResearchClaim>',
      "source id",
    ],
    [
      '<ResearchClaim kind="inference">Missing source</ResearchClaim>',
      "source id",
    ],
    [
      '<ResearchClaim kind="documented" source="manual">Missing date</ResearchClaim>',
      "checked date",
    ],
    [
      '<ResearchClaim kind="documented" source="manual" checked="2026-02-30">Bad date</ResearchClaim>',
      "valid YYYY-MM-DD",
    ],
    [
      '<ResearchClaim kind="proposal" source="missing">Bad citation</ResearchClaim>',
      "Unknown citation",
    ],
    [
      '<ResearchClaim kind="fact">Bad classification</ResearchClaim>',
      "Invalid props",
    ],
  ])("rejects invalid claims in both formats: %s", async (claim, message) => {
    await expect(renderDoc(`${claim}\n\n${SOURCE}`)).rejects.toThrow(message);
    await expect(mdxToAscii(`${claim}\n\n${SOURCE}`)).rejects.toThrow(message);
  });

  it("does not grade an unmeasured target", async () => {
    const source = `<PerformanceTarget ${TARGET} />`;
    const [{ body }, { markdown }] = await Promise.all([
      renderDoc(source),
      mdxToAscii(source),
    ]);
    for (const output of [body, markdown]) {
      expect(output).toContain("Not measured");
      expect(output).not.toMatch(/Meets target|Misses target/u);
      expect(output).toContain("p95");
      expect(output).toContain("Stub provider; Apple Silicon");
      expect(output).toContain("≤ 50 ms");
    }
  });

  it("accepts an observed zero as measured data", async () => {
    const source = `<PerformanceTarget ${TARGET} status="measured" actual="0" measuredAt="2026-09-25" />`;
    const [{ body }, { markdown }] = await Promise.all([
      renderDoc(source),
      mdxToAscii(source),
    ]);
    for (const output of [body, markdown]) {
      expect(output).toContain("Meets target");
      expect(output).toContain("0 ms");
      expect(output).toContain("2026-09-25");
    }
  });

  it.each([
    ["lower", "50", "Meets target"],
    ["lower", "51", "Misses target"],
    ["higher", "50", "Meets target"],
    ["higher", "49", "Misses target"],
  ])("compares %s inclusively: %s", async (better, actual, label) => {
    const source = `<PerformanceTarget ${TARGET} status="measured" better="${better}" actual="${actual}" />`;
    const [{ body }, { markdown }] = await Promise.all([
      renderDoc(source),
      mdxToAscii(source),
    ]);
    expect(body).toContain(label);
    expect(markdown).toContain(label);
  });

  it.each([
    'status="measured"',
    'status="unmeasured" actual="0"',
    'measuredAt="2026-09-25"',
    'status="measured" actual="50ms"',
    'status="measured" actual=""',
    'status="measured" actual="Infinity"',
    'status="measured" actual="NaN"',
    'status="measured" actual="1e999"',
  ])(
    "rejects contradictory or invalid observations: %s",
    async (attributes) => {
      const source = `<PerformanceTarget ${TARGET} ${attributes} />`;
      await expect(renderDoc(source)).rejects.toThrow("Invalid props");
      await expect(mdxToAscii(source)).rejects.toThrow("Invalid props");
    }
  );

  it.each([
    '<PerformanceTarget name="Latency" target="50" unit="ms" />',
    '<PerformanceTarget name="Latency" target="50ms" unit="ms" conditions="Stub" />',
  ])("requires a measurement scope and finite target: %s", async (source) => {
    await expect(renderDoc(source)).rejects.toThrow("Invalid props");
    await expect(mdxToAscii(source)).rejects.toThrow("Invalid props");
  });

  it("exposes schemas to agents and supports directives", async () => {
    const entries = catalogEntries();
    expect(
      entries.find((entry) => entry.name === "ResearchClaim")?.props.kind
        .required
    ).toBeTruthy();
    const target = entries.find((entry) => entry.name === "PerformanceTarget");
    expect(target?.props.conditions.required).toBeTruthy();
    expect(target?.props.status.default).toBe("unmeasured");
    const source = `:::researchclaim{kind="proposal"}\nTry a small core.\n:::\n\n:::performancetarget{${TARGET}}\n:::`;
    const [{ body }, { markdown }] = await Promise.all([
      renderDoc(source),
      mdxToAscii(source),
    ]);
    expect(body).toContain("Not measured");
    expect(markdown).toContain("Try a small core.");
  });
});

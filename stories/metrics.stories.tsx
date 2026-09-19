import type { Meta, StoryObj } from "@storybook/react-vite";

import { Bench, Benchmarks } from "../src/ui/benchmarks.js";
import { DiffStat } from "../src/ui/diffstat.js";
import { Gauge, Gauges } from "../src/ui/gauges.js";
import { Score } from "../src/ui/score.js";
import { Spark } from "../src/ui/spark.js";
import { Row } from "../src/ui/stack.js";

const meta = {
  component: Gauges,
  title: "Components/Metrics",
} satisfies Meta<typeof Gauges>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Coverage: Story = {
  render: () => (
    <Gauges title="Coverage by area" unit="lines">
      <Gauge detail="412/500 lines" path="src/mdx.ts" target="80" value="82" />
      <Gauge detail="90/200 lines" path="src/cli.ts" value="45" />
      <Gauge label="branches" target="70" value="71" />
    </Gauges>
  ),
};

export const Scores: Story = {
  render: () => (
    <Row>
      <Score detail="0 errors, 2 warnings" label="react-doctor" value="87" />
      <Score label="lint health" value="42" />
      <Score label="a11y audit" max="10" value="9" />
    </Row>
  ),
};

export const BenchTable: Story = {
  render: () => (
    <Benchmarks better="lower" title="render bench" unit="ms">
      <Bench after="98" before="120" name="small doc" />
      <Bench after="910ms" before="820ms" name="large doc" />
      <Bench after="4.1" before="4.0" name="catalog" note="noise" />
    </Benchmarks>
  ),
};

export const Inline: Story = {
  render: () => (
    <p>
      p95 latency improved <Spark tone="emerald" values="120,110,96,88,71,65" />{" "}
      over the last 6 runs. The PR changed{" "}
      <DiffStat adds="340" dels="120" files="12" /> across the renderer.
    </p>
  ),
};

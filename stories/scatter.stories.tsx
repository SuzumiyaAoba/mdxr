import type { Meta, StoryObj } from "@storybook/react-vite";

import { Point, Scatter } from "../src/ui/scatter.js";

const meta = {
  component: Scatter,
  title: "Components/Scatter",
} satisfies Meta<typeof Scatter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Correlation: Story = {
  render: () => (
    <Scatter title="latency vs payload" x="payload kb" y="latency ms">
      <Point x="12" y="40" />
      <Point x="30" y="62" />
      <Point x="48" y="81" />
      <Point x="64" y="97" />
      <Point x="96" y="150" />
      <Point x="140" y="210" />
    </Scatter>
  ),
};

export const Bubbles: Story = {
  render: () => (
    <Scatter title="repos" x="stars k" y="commits/wk">
      <Point name="core" size="90" tone="sky" x="18" y="42" />
      <Point name="docs" size="30" tone="emerald" x="4" y="12" />
      <Point name="cli" size="55" tone="violet" x="9" y="28" />
      <Point name="legacy" size="10" tone="amber" x="22" y="3" />
    </Scatter>
  ),
};

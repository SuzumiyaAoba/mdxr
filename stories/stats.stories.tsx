import type { Meta, StoryObj } from "@storybook/react-vite";

import { Stat, Stats } from "../src/ui/stats.js";

const meta = {
  component: Stats,
  title: "Components/Stats",
} satisfies Meta<typeof Stats>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Metrics: Story = {
  render: () => (
    <Stats>
      <Stat value="68" label="call sites migrated" delta="+12" />
      <Stat value="120ms" label="p95 render time" delta="-34%" />
      <Stat value="9" label="packages affected" />
      <Stat value="0" label="open blockers" delta="±0" />
    </Stats>
  ),
};

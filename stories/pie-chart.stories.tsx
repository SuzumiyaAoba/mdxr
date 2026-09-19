import type { Meta, StoryObj } from "@storybook/react-vite";

import { PieChart, Slice } from "../src/ui/pie-chart.js";

const meta = {
  component: PieChart,
  title: "Components/PieChart",
} satisfies Meta<typeof PieChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Share: Story = {
  render: () => (
    <PieChart title="traffic sources" unit="%">
      <Slice name="organic" value="46" />
      <Slice name="referral" value="24" />
      <Slice name="social" value="18" />
      <Slice name="direct" value="12" />
    </PieChart>
  ),
};

export const Donut: Story = {
  render: () => (
    <PieChart donut title="build minutes" unit="min">
      <Slice name="compile" note="tsc" value="38" />
      <Slice name="tests" value="27" />
      <Slice name="lint" value="9" />
      <Slice name="bundle" value="14" />
    </PieChart>
  ),
};

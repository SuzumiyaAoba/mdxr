import type { Meta, StoryObj } from "@storybook/react-vite";

import { Overlap, Set, Venn } from "../src/ui/venn.js";

const meta = {
  component: Venn,
  title: "Components/Venn",
} satisfies Meta<typeof Venn>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoSets: Story = {
  render: () => (
    <Venn title="skill coverage" unit="devs">
      <Set name="frontend" value="14" />
      <Set name="backend" value="18" />
      <Overlap sets="frontend,backend" value="6" />
    </Venn>
  ),
};

export const ThreeSets: Story = {
  render: () => (
    <Venn title="test types">
      <Set name="unit" value="40" />
      <Set name="e2e" value="25" />
      <Set name="visual" value="12" />
      <Overlap sets="unit,e2e" value="8" />
      <Overlap sets="unit,e2e,visual" value="3" />
    </Venn>
  ),
};

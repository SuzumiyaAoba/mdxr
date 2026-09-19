import type { Meta, StoryObj } from "@storybook/react-vite";

import { Node } from "../src/ui/graph.js";
import { Link, Sankey } from "../src/ui/sankey.js";

const meta = {
  component: Sankey,
  title: "Components/Sankey",
} satisfies Meta<typeof Sankey>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Energy: Story = {
  render: () => (
    <Sankey stages="source,grid,use" title="energy flow" unit="TWh">
      <Link from="solar" to="grid" value="40" />
      <Link from="wind" to="grid" value="35" />
      <Link from="gas" to="grid" value="25" />
      <Link from="grid" to="homes" value="55" />
      <Link from="grid" to="industry" value="45" />
      <Node id="grid" label="national grid" />
    </Sankey>
  ),
};

export const ExplicitStages: Story = {
  render: () => (
    <Sankey title="user journeys" unit="k">
      <Link from="ad" to="landing" value="30" />
      <Link from="search" to="landing" value="50" />
      <Link from="landing" to="trial" value="20" />
      <Link from="landing" to="bounce" value="60" />
      <Node id="bounce" stage="2" tone="red" />
    </Sankey>
  ),
};

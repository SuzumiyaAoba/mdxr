import type { Meta, StoryObj } from "@storybook/react-vite";

import { Tile, Treemap } from "../src/ui/treemap.js";

const meta = {
  component: Treemap,
  title: "Components/Treemap",
} satisfies Meta<typeof Treemap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BundleSize: Story = {
  render: () => (
    <Treemap title="bundle by workspace" unit="kB">
      <Tile name="ui" value="184" />
      <Tile name="remark" value="96" />
      <Tile name="cli" value="72" />
      <Tile name="catalog" value="40" />
      <Tile name="vendor" note="react+mdx" value="260" />
    </Treemap>
  ),
};

export const Storage: Story = {
  render: () => (
    <Treemap title="bucket usage" unit="GB">
      <Tile name="artifacts" tone="sky" value="420" />
      <Tile name="snapshots" tone="violet" value="180" />
      <Tile name="logs" tone="amber" value="90" />
      <Tile name="tmp" value="12" />
    </Treemap>
  ),
};

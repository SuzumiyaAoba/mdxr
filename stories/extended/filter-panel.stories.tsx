import type { Meta, StoryObj } from "@storybook/react-vite";

import { DataTable, FilterPanel } from "../../src/ui/data-table.js";
import { DotPlot } from "../../src/ui/plot-dot-plot.js";

const meta = {
  args: {
    fields: "status",
  },
  component: FilterPanel,
  parameters: {
    docs: {
      description: {
        component: FilterPanel.__mdxr?.description,
      },
    },
  },
  render: (args) => (
    <FilterPanel {...args}>
      <DataTable
        data={JSON.stringify([
          {
            id: "alpha",
            name: "Alpha",
            status: "ready",
            value: 20,
          },
          {
            id: "beta",
            name: "Beta",
            status: "pending",
            value: 10,
          },
          {
            id: "gamma",
            name: "Gamma",
            status: "ready",
            value: 30,
          },
        ])}
      />
      <DotPlot
        data={JSON.stringify([
          {
            name: "Alpha",
            status: "ready",
            value: 20,
          },
          {
            name: "Beta",
            status: "pending",
            value: 10,
          },
        ])}
      />
    </FilterPanel>
  ),
  title: "Components/FilterPanel",
} satisfies Meta<typeof FilterPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

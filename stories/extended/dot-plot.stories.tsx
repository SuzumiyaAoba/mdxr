import type { Meta, StoryObj } from "@storybook/react-vite";

import { DotPlot } from "../../src/ui/plot-dot-plot.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        name: "A",
        value: 12,
      },
      {
        name: "B",
        value: 8,
      },
    ]),
  },
  component: DotPlot,
  parameters: {
    docs: {
      description: {
        component: DotPlot.__mdxr?.description,
      },
    },
  },
  title: "Components/DotPlot",
} satisfies Meta<typeof DotPlot>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

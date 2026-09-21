import type { Meta, StoryObj } from "@storybook/react-vite";

import { ViolinPlot } from "../../src/ui/plot-violin-plot.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        name: "A",
        values: [1, 2, 2, 3, 4, 5, 6],
      },
      {
        name: "B",
        values: [3, 4, 4, 5, 6, 8],
      },
    ]),
  },
  component: ViolinPlot,
  parameters: {
    docs: {
      description: {
        component: ViolinPlot.__mdxr?.description,
      },
    },
  },
  title: "Components/ViolinPlot",
} satisfies Meta<typeof ViolinPlot>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

import type { Meta, StoryObj } from "@storybook/react-vite";

import { BoxPlot } from "../../src/ui/plot-box-plot.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        name: "A",
        values: [1, 2, 3, 4, 5, 20],
      },
      {
        name: "B",
        values: [2, 3, 4, 5, 6],
      },
    ]),
  },
  component: BoxPlot,
  parameters: {
    docs: {
      description: {
        component: BoxPlot.__mdxr?.description,
      },
    },
  },
  title: "Components/BoxPlot",
} satisfies Meta<typeof BoxPlot>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

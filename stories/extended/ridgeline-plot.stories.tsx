import type { Meta, StoryObj } from "@storybook/react-vite";

import { RidgelinePlot } from "../../src/ui/plot-ridgeline-plot.js";

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
  component: RidgelinePlot,
  parameters: {
    docs: {
      description: {
        component: RidgelinePlot.__mdxr?.description,
      },
    },
  },
  title: "Components/RidgelinePlot",
} satisfies Meta<typeof RidgelinePlot>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

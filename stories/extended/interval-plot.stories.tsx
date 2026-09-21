import type { Meta, StoryObj } from "@storybook/react-vite";

import { IntervalPlot } from "../../src/ui/plot-interval-plot.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        high: 7,
        low: 3,
        name: "A",
        value: 5,
      },
      {
        high: 9,
        low: 6,
        name: "B",
        value: 8,
      },
    ]),
  },
  component: IntervalPlot,
  parameters: {
    docs: {
      description: {
        component: IntervalPlot.__mdxr?.description,
      },
    },
  },
  title: "Components/IntervalPlot",
} satisfies Meta<typeof IntervalPlot>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

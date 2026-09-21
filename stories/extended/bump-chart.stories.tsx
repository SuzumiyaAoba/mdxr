import type { Meta, StoryObj } from "@storybook/react-vite";

import { BumpChart } from "../../src/ui/plot-bump-chart.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        name: "A",
        values: [1, 2, 1],
      },
      {
        name: "B",
        values: [2, 1, 2],
      },
    ]),
    options: JSON.stringify({
      labels: ["Q1", "Q2", "Q3"],
    }),
  },
  component: BumpChart,
  parameters: {
    docs: {
      description: {
        component: BumpChart.__mdxr?.description,
      },
    },
  },
  title: "Components/BumpChart",
} satisfies Meta<typeof BumpChart>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

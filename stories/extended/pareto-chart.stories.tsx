import type { Meta, StoryObj } from "@storybook/react-vite";

import { ParetoChart } from "../../src/ui/plot-pareto-chart.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        name: "Network",
        value: 50,
      },
      {
        name: "Parser",
        value: 30,
      },
      {
        name: "Other",
        value: 20,
      },
    ]),
  },
  component: ParetoChart,
  parameters: {
    docs: {
      description: {
        component: ParetoChart.__mdxr?.description,
      },
    },
  },
  title: "Components/ParetoChart",
} satisfies Meta<typeof ParetoChart>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

import type { Meta, StoryObj } from "@storybook/react-vite";

import { SlopeChart } from "../../src/ui/plot-slope-chart.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        after: 9,
        before: 5,
        name: "A",
      },
      {
        after: 6,
        before: 8,
        name: "B",
      },
    ]),
  },
  component: SlopeChart,
  parameters: {
    docs: {
      description: {
        component: SlopeChart.__mdxr?.description,
      },
    },
  },
  title: "Components/SlopeChart",
} satisfies Meta<typeof SlopeChart>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

import type { Meta, StoryObj } from "@storybook/react-vite";

import { DumbbellChart } from "../../src/ui/plot-dumbbell-chart.js";

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
  component: DumbbellChart,
  parameters: {
    docs: {
      description: {
        component: DumbbellChart.__mdxr?.description,
      },
    },
  },
  title: "Components/DumbbellChart",
} satisfies Meta<typeof DumbbellChart>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

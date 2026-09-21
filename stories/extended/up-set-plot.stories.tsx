import type { Meta, StoryObj } from "@storybook/react-vite";

import { UpSetPlot } from "../../src/ui/plot-up-set-plot.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        sets: ["A"],
        value: 10,
      },
      {
        sets: ["B"],
        value: 7,
      },
      {
        sets: ["A", "B"],
        value: 4,
      },
    ]),
  },
  component: UpSetPlot,
  parameters: {
    docs: {
      description: {
        component: UpSetPlot.__mdxr?.description,
      },
    },
  },
  title: "Components/UpSetPlot",
} satisfies Meta<typeof UpSetPlot>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

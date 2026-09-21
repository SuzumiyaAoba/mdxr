import type { Meta, StoryObj } from "@storybook/react-vite";

import { Heatmap } from "../../src/ui/plot-heatmap.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        value: 3,
        x: "Mon",
        y: "API",
      },
      {
        value: 8,
        x: "Tue",
        y: "API",
      },
      {
        value: 5,
        x: "Mon",
        y: "Worker",
      },
      {
        value: 2,
        x: "Tue",
        y: "Worker",
      },
    ]),
  },
  component: Heatmap,
  parameters: {
    docs: {
      description: {
        component: Heatmap.__mdxr?.description,
      },
    },
  },
  title: "Components/Heatmap",
} satisfies Meta<typeof Heatmap>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

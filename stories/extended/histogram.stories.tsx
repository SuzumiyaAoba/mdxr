import type { Meta, StoryObj } from "@storybook/react-vite";

import { Histogram } from "../../src/ui/plot-histogram.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        values: [1, 1, 2, 3, 3, 3, 4, 5, 8, 9],
      },
    ]),
    options: JSON.stringify({
      bins: 4,
    }),
  },
  component: Histogram,
  parameters: {
    docs: {
      description: {
        component: Histogram.__mdxr?.description,
      },
    },
  },
  title: "Components/Histogram",
} satisfies Meta<typeof Histogram>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

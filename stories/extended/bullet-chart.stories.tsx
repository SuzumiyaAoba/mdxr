import type { Meta, StoryObj } from "@storybook/react-vite";

import { BulletChart } from "../../src/ui/plot-bullet-chart.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        name: "Revenue",
        ranges: [50, 75, 100],
        target: 85,
        value: 72,
      },
    ]),
  },
  component: BulletChart,
  parameters: {
    docs: {
      description: {
        component: BulletChart.__mdxr?.description,
      },
    },
  },
  title: "Components/BulletChart",
} satisfies Meta<typeof BulletChart>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};

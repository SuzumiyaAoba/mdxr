import type { Meta, StoryObj } from "@storybook/react-vite";

import { BenchmarkSuite } from "../../src/ui/quality-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        name: "Render",
        samples: [9, 10, 12, 8, 11],
        unit: "ms",
      },
    ]),
  },
  component: BenchmarkSuite,
  parameters: {
    docs: {
      description: {
        component: BenchmarkSuite.__mdxr?.description,
      },
    },
  },
  title: "Components/BenchmarkSuite",
} satisfies Meta<typeof BenchmarkSuite>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };

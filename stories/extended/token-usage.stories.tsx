import type { Meta, StoryObj } from "@storybook/react-vite";

import { TokenUsage } from "../../src/ui/evaluation-reports.js";

const meta = {
  args: {
    data: JSON.stringify([
      {
        cacheRate: 0.2,
        cached: 6000,
        input: 10_000,
        inputRate: 2,
        name: "Example run",
        output: 800,
        outputRate: 8,
      },
    ]),
  },
  component: TokenUsage,
  parameters: {
    docs: {
      description: {
        component: TokenUsage.__mdxr?.description,
      },
    },
  },
  title: "Components/TokenUsage",
} satisfies Meta<typeof TokenUsage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { data: JSON.stringify([]) } };

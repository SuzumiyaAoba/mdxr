import type { Meta, StoryObj } from "@storybook/react-vite";

import { PerformanceTarget } from "../src/ui/performance-target.js";

const meta = {
  args: {
    conditions: "Stub provider; 100,000 events; Japanese IME",
    name: "Input latency",
    statistic: "p95",
    target: "50",
    unit: "ms",
  },
  component: PerformanceTarget,
  title: "Components/PerformanceTarget",
} satisfies Meta<typeof PerformanceTarget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Measured: Story = {
  args: { actual: "42", measuredAt: "2026-09-25", status: "measured" },
};
export const Missed: Story = { args: { actual: "65", status: "measured" } };
export const ObservedZero: Story = {
  args: { actual: "0", status: "measured" },
};

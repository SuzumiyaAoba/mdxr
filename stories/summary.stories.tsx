import type { Meta, StoryObj } from "@storybook/react-vite";

import { Summary } from "../src/ui/summary.js";

const meta = {
  args: { done: "4", label: "Overall progress", total: "9" },
  component: Summary,
  title: "Components/Summary",
} satisfies Meta<typeof Summary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InProgress: Story = {};

export const Complete: Story = { args: { done: "9" } };

export const Empty: Story = { args: { done: "0", total: "0" } };

export const NumericArgs: Story = { args: { done: 3, total: 4 } };

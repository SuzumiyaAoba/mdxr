import type { Meta, StoryObj } from "@storybook/react-vite";

import { Due } from "../src/ui/due.js";

const meta = {
  args: { date: "2026-10-15" },
  component: Due,
  title: "Components/Due",
} satisfies Meta<typeof Due>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Upcoming: Story = {};

export const Overdue: Story = { args: { date: "2026-01-01" } };

export const WithLabel: Story = {
  args: { date: "2026-10-15", label: "Target" },
};

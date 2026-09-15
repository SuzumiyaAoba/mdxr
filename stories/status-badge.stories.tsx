import type { Meta, StoryObj } from "@storybook/react-vite";

import { STATUSES, StatusBadge } from "../src/ui/status-badge.js";

const meta = {
  argTypes: {
    status: { control: "select", options: [...STATUSES] },
  },
  args: { status: "todo" },
  component: StatusBadge,
  title: "Components/StatusBadge",
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Todo: Story = {};

export const Doing: Story = { args: { status: "doing" } };

export const Done: Story = { args: { status: "done" } };

export const Blocked: Story = { args: { status: "blocked" } };

export const All: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      {STATUSES.map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  ),
};

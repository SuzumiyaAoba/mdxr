import type { Meta, StoryObj } from "@storybook/react-vite";

import { Phase } from "../src/ui/phase.js";
import { STATUSES } from "../src/ui/status-badge.js";

const meta = {
  argTypes: {
    status: { control: "select", options: [...STATUSES] },
  },
  args: {
    children: (
      <p>Replace the string-template renderer with a component pipeline.</p>
    ),
    status: "doing",
    title: "Phase 2 — extensibility",
  },
  component: Phase,
  title: "Components/Phase",
} satisfies Meta<typeof Phase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Doing: Story = {};

export const Done: Story = { args: { status: "done" } };

export const NoStatus: Story = { args: { status: undefined } };

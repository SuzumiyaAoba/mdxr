import type { Meta, StoryObj } from "@storybook/react-vite";

import { PRIORITY_LEVELS, Priority } from "../src/ui/priority.js";

const meta = {
  argTypes: {
    level: { control: "select", options: [...PRIORITY_LEVELS] },
  },
  args: { level: "p1" },
  component: Priority,
  title: "Components/Priority",
} satisfies Meta<typeof Priority>;

export default meta;
type Story = StoryObj<typeof meta>;

export const P1: Story = {};

export const WithNote: Story = {
  args: { children: "release blocker", level: "p0" },
};

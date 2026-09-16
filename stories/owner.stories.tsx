import type { Meta, StoryObj } from "@storybook/react-vite";

import { Owner } from "../src/ui/owner.js";

const meta = {
  args: { name: "@alice" },
  component: Owner,
  title: "Components/Owner",
} satisfies Meta<typeof Owner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NameOnly: Story = {};

export const WithRole: Story = {
  args: { name: "Bob Tanaka", role: "security" },
};

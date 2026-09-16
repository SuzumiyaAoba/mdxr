import type { Meta, StoryObj } from "@storybook/react-vite";

import { Icon } from "../src/ui/icon.js";

const meta = {
  args: { className: "h-5 w-5", name: "lucide:rocket" },
  component: Icon,
  title: "Components/Icon",
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const BareName: Story = { args: { name: "check" } };

export const Labeled: Story = {
  args: { label: "deployed", name: "lucide:circle-check" },
};

export const InlineText: Story = {
  render: () => (
    <p>
      Ship <Icon className="h-4 w-4 text-teal-500" name="lucide:rocket" /> the
      pipeline <Icon className="h-4 w-4" name="lucide:git-branch" /> today.
    </p>
  ),
};

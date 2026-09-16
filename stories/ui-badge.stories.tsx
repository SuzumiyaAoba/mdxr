import type { Meta, StoryObj } from "@storybook/react-vite";

import { Badge } from "../src/components/ui/badge.js";

const VARIANTS = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "destructive",
  "link",
] as const;

const meta = {
  argTypes: {
    variant: { control: "select", options: [...VARIANTS] },
  },
  args: { children: "Badge", variant: "default" },
  component: Badge,
  title: "Components/UI/Badge",
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {VARIANTS.map((variant) => (
        <Badge key={variant} variant={variant}>
          {variant}
        </Badge>
      ))}
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "../src/components/ui/button.js";

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
    size: { control: "select", options: ["xs", "sm", "default", "lg", "icon"] },
    variant: { control: "select", options: [...VARIANTS] },
  },
  args: { children: "Button", size: "default", variant: "default" },
  component: Button,
  title: "Components/UI/Button",
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {VARIANTS.map((variant) => (
        <Button key={variant} variant={variant}>
          {variant}
        </Button>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Button size="xs">xs</Button>
      <Button size="sm">sm</Button>
      <Button size="default">default</Button>
      <Button size="lg">lg</Button>
    </div>
  ),
};

import type { Meta, StoryObj } from "@storybook/react-vite";

import { EFFORT_SIZES, Effort } from "../src/ui/effort.js";

const meta = {
  argTypes: {
    size: { control: "select", options: [...EFFORT_SIZES] },
  },
  args: { size: "m" },
  component: Effort,
  title: "Components/Effort",
} satisfies Meta<typeof Effort>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Medium: Story = {};

export const WithEstimate: Story = {
  args: { children: "3d", size: "l" },
};
